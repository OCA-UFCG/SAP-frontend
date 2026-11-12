/**
 * Monta o tabelão do chatbot (data/sedes.sqlite) direto das fontes que o
 * relatório do site usa hoje: as tabelas estatísticas do Earth Engine e os
 * instantâneos das planilhas, com o cadastro de índices do Contentful.
 *
 * Cada tabela do Earth Engine é lida inteira numa ida só (todos os níveis:
 * Brasil, regiões, biomas, ASD, Semiárido, estados e municípios), do mesmo
 * jeito que o deploy copia as linhas municipais. As linhas passam pelas
 * mesmas funções do relatório (`matchesStatisticsPeriod`,
 * `mapGeeStatisticsRows`): o período, a validação dos percentuais e o descarte
 * da linha toda zerada são os do site, não uma cópia.
 *
 * Medido em 12/11/2026: 185 tabelas, 6,5 milhões de linhas, ~1 min 40 s de
 * leitura com 6 de cada vez (~10 min somados de vaga na fila do Earth Engine).
 *
 * Roda na raiz do repositório, com o .env do site (GEE_PRIVATE_KEY e Contentful):
 *   npm --prefix tools/sedes-chatbot run tabelao
 * Variáveis opcionais:
 *   SEDES_SO_INDICES=id1,id2   monta só esses índices, em data/sedes-parcial.sqlite
 *   SEDES_CONCORRENCIA_EE=4    quantas tabelas são lidas ao mesmo tempo
 */
import nextEnv from "@next/env";
import ee from "@google/earthengine";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  inferGeeStatisticsSchema,
  resolveGeeStatisticsSource,
  type GeeFeatureCollectionStatisticsSource,
} from "@/contracts/geeStatistics";
import { isMunicipalSpreadsheetSource } from "@/contracts/municipalSpreadsheet";
import { buildSpatialLocationKey } from "@/contracts/spatialLocationKey.mjs";
import {
  evaluateGeeObject,
  initializeGee,
  listGeeFolderAssetUpdateTimes,
} from "@/infrastructure/earth-engine/client";
import {
  describeGeeStatisticsMunicipalTables,
  mapGeeStatisticsRows,
  matchesStatisticsPeriod,
} from "@/repositories/platform/geeStatisticsRepository";
import { getOrLoadSpreadsheetSnapshot } from "@/repositories/platform/municipalSpreadsheetSnapshotCache";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import { isCompactImageData } from "@/utils/imageData";
import { semAcento } from "../texto.ts";
import { OBSERVACOES } from "../observacoes.ts";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PACOTE = path.resolve(AQUI, "../..");
const REPO = path.resolve(PACOTE, "../..");
const RECORTES = path.join(REPO, "src/data/municipalityTerritories.json");
const SO_INDICES = process.env.SEDES_SO_INDICES?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const SAIDA = path.join(
  PACOTE,
  SO_INDICES ? "data/sedes-parcial.sqlite" : "data/sedes.sqlite",
);
const CONCORRENCIA = Number(process.env.SEDES_CONCORRENCIA_EE ?? 4);

const REGIAO_POR_DIGITO: Record<string, string> = {
  "1": "Norte",
  "2": "Nordeste",
  "3": "Sudeste",
  "4": "Sul",
  "5": "Centro-Oeste",
};
const ESCALA: Record<string, string> = {
  year: "anual",
  month: "mensal",
  dekad: "decendial",
};

interface Indice {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  escala: string;
  periodos: string[];
  rotulos: Map<string, string>;
  classes: string[];
  tipoValor: "distribuicao" | "valor_unico";
  significado: string;
  unidade: string;
  fonte: "earth-engine" | "planilha";
  agregacao: string;
  previsao: boolean;
  atualizadoEm: string | null;
}

type Linha = Record<string, unknown>;

const inicio = Date.now();
const problemas: string[] = [];
const rotulosTerritorio = new Map<string, Set<string>>();
let linhasValores = 0;

function anotarTerritorio(chave: string, rotulo: string) {
  const atual = rotulosTerritorio.get(chave);
  if (atual) atual.add(rotulo);
  else rotulosTerritorio.set(chave, new Set([rotulo]));
}

/** A mesma chave de período de `groupStatisticsRowsByPeriod`, no app. */
function chaveDoPeriodo(
  source: GeeFeatureCollectionStatisticsSource,
  linha: Linha,
) {
  if (source.periodGranularity === "year")
    return String(Number(linha[source.properties.year]));
  const data = String(linha[source.properties.date]);
  return source.periodGranularity === "month"
    ? data.replace(/-01$/u, "")
    : data;
}

/** Arredonda o ruído de ponto flutuante sem mudar a casa que o site mostra. */
function arredondar(valor: number) {
  return Math.round(valor * 1e6) / 1e6;
}

function criarBanco(arquivo: string) {
  rmSync(arquivo, { force: true });
  const db = new DatabaseSync(arquivo);
  db.exec(`
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    PRAGMA cache_size = -200000;

    CREATE TABLE metadados (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);

    CREATE TABLE indices (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      categoria TEXT,
      escala_temporal TEXT NOT NULL,
      primeiro_periodo TEXT,
      ultimo_periodo TEXT,
      qtd_periodos INTEGER NOT NULL,
      tipo_valor TEXT NOT NULL,
      significado_valor TEXT NOT NULL,
      unidade TEXT NOT NULL,
      fonte TEXT NOT NULL,
      agregacao TEXT NOT NULL,
      previsao INTEGER NOT NULL,
      atualizado_em TEXT,
      observacao TEXT
    );

    CREATE TABLE classes (
      indice TEXT NOT NULL REFERENCES indices(id),
      ordem INTEGER NOT NULL,
      rotulo TEXT NOT NULL,
      PRIMARY KEY (indice, ordem)
    ) WITHOUT ROWID;

    CREATE TABLE periodos (
      indice TEXT NOT NULL REFERENCES indices(id),
      periodo TEXT NOT NULL,
      rotulo TEXT NOT NULL,
      PRIMARY KEY (indice, periodo)
    ) WITHOUT ROWID;

    CREATE TABLE territorios (
      codigo TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      nome_sem_acento TEXT NOT NULL,
      tipo TEXT NOT NULL,
      uf TEXT,
      regiao TEXT,
      bioma TEXT,
      semiarido INTEGER,
      asd_entorno INTEGER
    );

    CREATE TABLE valores (
      indice TEXT NOT NULL,
      periodo TEXT NOT NULL,
      ano INTEGER NOT NULL,
      mes INTEGER,
      territorio TEXT NOT NULL,
      classe INTEGER NOT NULL,
      valor REAL NOT NULL,
      PRIMARY KEY (indice, periodo, territorio, classe)
    ) WITHOUT ROWID;
  `);
  return db;
}

function inserirValores(
  ins: StatementSync,
  indice: string,
  periodo: string,
  territorio: string,
  valores: readonly number[],
  escala: number,
) {
  const ano = Number(periodo.slice(0, 4));
  const mes = periodo.length >= 7 ? Number(periodo.slice(5, 7)) : null;
  valores.forEach((v, i) => {
    ins.run(
      indice,
      periodo,
      ano,
      mes,
      territorio,
      i + 1,
      arredondar(Number(v) / escala),
    );
  });
  linhasValores += valores.length;
}

/** A tabela inteira, como objetos, numa ida só ao Earth Engine. */
async function lerTabela(assetId: string, colunas: string[]): Promise<Linha[]> {
  const fc = ee.FeatureCollection(assetId);
  const r = await evaluateGeeObject<{
    rows?: { list?: unknown[][] };
    count?: number;
  }>(
    ee.Dictionary({
      rows: fc.reduceColumns(ee.Reducer.toList(colunas.length), colunas),
      count: fc.size(),
    }),
  );
  const lista = r?.rows?.list;
  if (!Array.isArray(lista))
    throw new Error(`resposta inválida do Earth Engine para ${assetId}`);
  if (lista.length !== r?.count) {
    problemas.push(
      `${assetId}: ${r?.count} linhas, mas só ${lista.length} sem célula vazia (as outras ficaram de fora).`,
    );
  }
  return lista.map((celulas) =>
    Object.fromEntries(colunas.map((c, i) => [c, celulas[i]])),
  );
}

/** Passa as linhas de uma tabela pelas funções do relatório e grava os valores. */
function gravarLinhas(
  db: DatabaseSync,
  ins: StatementSync,
  indice: Indice,
  source: GeeFeatureCollectionStatisticsSource,
  colunas: string[],
  linhas: Linha[],
) {
  const periodosDoIndice = new Set(indice.periodos);
  const porPeriodo = new Map<string, Linha[]>();
  for (const linha of linhas) {
    const periodo = chaveDoPeriodo(source, linha);
    if (!periodosDoIndice.has(periodo)) continue;
    const lista = porPeriodo.get(periodo);
    if (lista) lista.push(linha);
    else porPeriodo.set(periodo, [linha]);
  }

  const nivel = source.properties.level;
  db.exec("BEGIN");
  for (const [periodo, doPeriodo] of porPeriodo) {
    const resolvida = resolveGeeStatisticsSource(source, periodo);
    const esquema = inferGeeStatisticsSchema(resolvida, colunas);
    const conferidas = doPeriodo.filter((l) =>
      matchesStatisticsPeriod(resolvida, l, periodo),
    );
    if (conferidas.length !== doPeriodo.length) {
      problemas.push(
        `${indice.id} ${periodo}: a regra de período do site descartou ${doPeriodo.length - conferidas.length} linhas.`,
      );
    }

    // O Brasil e as UFs saem juntos, como no relatório; os outros um a um.
    const grupos: Array<[string, Linha[]]> = [
      [
        "br",
        conferidas.filter(
          (l) => l[nivel] === "1_BR" || l[nivel] === "6_Estado",
        ),
      ],
    ];
    for (const l of conferidas) {
      const n = String(l[nivel]);
      if (n === "1_BR" || n === "6_Estado") continue;
      try {
        const chave =
          n === "7_Municipio"
            ? String(l[source.properties.municipalityCode]).trim()
            : buildSpatialLocationKey(n, l[source.properties.locationName]);
        grupos.push([chave, [l]]);
      } catch (e) {
        problemas.push(
          `${indice.id} ${periodo}: linha sem território reconhecido (${(e as Error).message}).`,
        );
      }
    }

    for (const [chave, grupo] of grupos) {
      if (!grupo.length) continue;
      try {
        const r = mapGeeStatisticsRows(
          resolvida,
          esquema,
          periodo,
          chave,
          grupo,
          indice.classes.length,
        );
        for (const [k, rotulo] of Object.entries(r.patch.locations ?? {}))
          anotarTerritorio(k, rotulo);
        const ano = r.patch.years?.[periodo];
        if (!ano?.values) continue;
        for (const [territorio, valores] of Object.entries(ano.values)) {
          inserirValores(
            ins,
            indice.id,
            periodo,
            territorio,
            valores as number[],
            ano.valuesScale ?? 1,
          );
        }
      } catch (e) {
        problemas.push(
          `${indice.id} ${periodo} ${chave}: ${(e as Error).message}`,
        );
      }
    }
  }
  db.exec("COMMIT");
}

function resumoDoIndice(
  layer: Awaited<ReturnType<typeof getPanelLayers>>[number],
): Indice | null {
  const source = layer.statisticsSource;
  if (!source || !isCompactImageData(layer.imageData)) return null;
  const dataset = layer.imageData;
  const periodos = Object.keys(dataset.years).sort();
  const absoluto = dataset.valueConfig?.type === "absolute";
  const unidade = dataset.valueConfig?.unit ?? (absoluto ? "" : "%");
  const umaClasse = dataset.classes.length === 1;
  const planilha = isMunicipalSpreadsheetSource(source);
  const titulo = dataset.valueConfig?.distributionTitle ?? layer.name;
  return {
    id: layer.id,
    nome: layer.name,
    descricao:
      typeof layer.description === "string" ? layer.description.trim() : "",
    categoria: layer.category ?? "",
    escala: planilha
      ? "anual"
      : (ESCALA[
          (source as GeeFeatureCollectionStatisticsSource).periodGranularity
        ] ?? "?"),
    periodos,
    rotulos: new Map(
      periodos.map((p) => [p, dataset.years[p]?.year?.trim() || p]),
    ),
    classes: dataset.classes.map((c) => c.label),
    tipoValor: umaClasse ? "valor_unico" : "distribuicao",
    significado: umaClasse
      ? `${titulo}${unidade ? ` (${unidade})` : ""}. Um valor só por território e período (classe = 1).`
      : "Percentual da área do território em cada classe; as classes de um território num período somam 100%.",
    unidade,
    fonte: planilha ? "planilha" : "earth-engine",
    agregacao: planilha
      ? source.aggregation === "sum"
        ? "Estados, Brasil e recortes são a SOMA dos municípios (calculada pelo site)."
        : "Estados, Brasil e recortes são a MÉDIA SIMPLES dos municípios, sem pesar por população (calculada pelo site)."
      : "Cada território (Brasil, região, bioma, Semiárido, ASD, estado, município) tem valor próprio calculado no Earth Engine sobre a área dele; não é média dos municípios.",
    previsao:
      Boolean(layer.forecastFacets) ||
      /previs/iu.test(`${layer.id} ${layer.name}`),
    atualizadoEm: null,
  };
}

function montarTerritorios(db: DatabaseSync) {
  const recortes = (
    JSON.parse(readFileSync(RECORTES, "utf8")) as {
      municipalities: Record<string, string[]>;
    }
  ).municipalities;
  const biomaPorChave = new Map<string, string>();
  const regiaoDaUf = new Map<string, string>();
  const escolhido = new Map<string, string>();
  for (const [chave, rotulos] of rotulosTerritorio) {
    const lista = [...rotulos];
    // Para município, o rótulo com " - UF" (o do Earth Engine) diz a UF.
    escolhido.set(
      chave,
      lista.find((r) => / - [A-Z]{2}$/u.test(r)) ?? lista[0],
    );
    if (chave.startsWith("3_bioma-")) biomaPorChave.set(chave, lista[0]);
  }
  for (const [chave, rotulo] of escolhido) {
    const uf = rotulo.match(/ - ([A-Z]{2})$/u)?.[1];
    if (/^\d{7}$/u.test(chave) && uf)
      regiaoDaUf.set(uf, REGIAO_POR_DIGITO[chave[0]]);
  }

  const ins = db.prepare(
    "INSERT INTO territorios VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const [chave, rotulo] of escolhido) {
    let tipo: string;
    let nome = rotulo;
    let uf: string | null = null;
    let regiao: string | null = null;
    let bioma: string | null = null;
    let semiarido: number | null = null;
    let asd: number | null = null;
    if (/^\d{7}$/u.test(chave)) {
      // As lagoas Mirim e dos Patos têm código IBGE, mas não são municípios.
      tipo = /^Área Operacional/u.test(rotulo) ? "lagoa" : "municipio";
      uf = rotulo.match(/ - ([A-Z]{2})$/u)?.[1] ?? null;
      nome = rotulo.replace(/ - [A-Z]{2}$/u, "");
      regiao = REGIAO_POR_DIGITO[chave[0]] ?? null;
      const grupos = recortes[chave] ?? [];
      bioma = grupos.map((g) => biomaPorChave.get(g)).find(Boolean) ?? null;
      semiarido = grupos.includes("5_semiarido-semiarido-total") ? 1 : 0;
      asd = grupos.includes("4_asd-asd-entorno") ? 1 : 0;
    } else if (chave === "br") {
      tipo = "pais";
      nome = "Brasil";
    } else if (/^[a-z]{2}$/u.test(chave)) {
      tipo = "estado";
      uf = chave.toUpperCase();
      regiao = regiaoDaUf.get(uf) ?? null;
    } else if (chave.startsWith("2_")) tipo = "regiao";
    else if (chave.startsWith("3_")) tipo = "bioma";
    else if (chave.startsWith("4_")) tipo = "asd";
    else if (chave.startsWith("5_")) tipo = "semiarido";
    else tipo = "outro";
    ins.run(
      chave,
      nome,
      semAcento(nome),
      tipo,
      uf,
      regiao,
      bioma,
      semiarido,
      asd,
    );
  }
  return escolhido.size;
}

async function main() {
  nextEnv.loadEnvConfig(REPO);
  if (!process.env.GEE_PRIVATE_KEY)
    throw new Error("Falta GEE_PRIVATE_KEY no .env da raiz do repositório.");
  await initializeGee();

  const camadas = (await getPanelLayers()).filter(
    (l) =>
      l.statisticsSource &&
      l.reportConfig?.includeInReport !== false &&
      !l.id.startsWith("teste-") &&
      (!SO_INDICES || SO_INDICES.includes(l.id)),
  );
  console.log(
    `[tabelão] ${camadas.length} índices do catálogo com fonte estatística.`,
  );

  mkdirSync(path.dirname(SAIDA), { recursive: true });
  const temporario = `${SAIDA}.montando`;
  const db = criarBanco(temporario);
  const insValor = db.prepare(
    "INSERT INTO valores VALUES (?, ?, ?, ?, ?, ?, ?)",
  );

  // Plano: que tabelas cada índice lê. Uma tabela usada por dois índices é lida uma vez.
  const indices = new Map<string, Indice>();
  const tabelas = new Map<
    string,
    {
      colunas: string[];
      usos: Array<{
        indice: Indice;
        source: GeeFeatureCollectionStatisticsSource;
      }>;
    }
  >();
  const assetsDoIndice = new Map<string, string[]>();
  const tPlano = Date.now();
  let proximaCamada = 0;
  await Promise.all(
    Array.from({ length: CONCORRENCIA }, async () => {
      while (proximaCamada < camadas.length) {
        const layer = camadas[proximaCamada++];
        const indice = resumoDoIndice(layer);
        if (!indice) continue;
        const source = layer.statisticsSource!;
        if (isMunicipalSpreadsheetSource(source)) {
          indices.set(indice.id, indice);
          continue;
        }
        if (source.kind !== "gee-feature-collection") {
          problemas.push(
            `${layer.id}: fonte ${source.kind} ainda não é lida pelo tabelão.`,
          );
          continue;
        }
        try {
          const d = await describeGeeStatisticsMunicipalTables(
            source,
            indice.periodos,
          );
          if (!d) continue;
          indices.set(indice.id, indice);
          assetsDoIndice.set(indice.id, d.assetIds);
          for (const assetId of d.assetIds) {
            const t = tabelas.get(assetId);
            if (t) {
              t.colunas = [...new Set([...t.colunas, ...d.layout.columns])];
              t.usos.push({ indice, source });
            } else
              tabelas.set(assetId, {
                colunas: d.layout.columns,
                usos: [{ indice, source }],
              });
          }
        } catch (e) {
          problemas.push(
            `${layer.id}: não deu para ler as colunas (${(e as Error).message}); índice fora do tabelão.`,
          );
        }
      }
    }),
  );
  console.log(
    `[tabelão] plano: ${tabelas.size} tabelas do Earth Engine em ${((Date.now() - tPlano) / 1000).toFixed(0)} s.`,
  );

  // Data de atualização: o updateTime do asset, que é só metadado (não ocupa vaga).
  const atualizadoEm = new Map<string, number>();
  for (const pasta of new Set(
    [...tabelas.keys()].map((a) => path.posix.dirname(a)),
  )) {
    for (const [a, t] of await listGeeFolderAssetUpdateTimes(pasta))
      atualizadoEm.set(a, t);
  }
  for (const [id, assets] of assetsDoIndice) {
    const maior = Math.max(...assets.map((a) => atualizadoEm.get(a) ?? 0));
    const indice = indices.get(id)!;
    if (maior > 0) indice.atualizadoEm = new Date(maior).toISOString();
  }

  // Planilhas: o instantâneo publicado já traz todos os recortes calculados.
  for (const layer of camadas) {
    const source = layer.statisticsSource;
    const indice = indices.get(layer.id);
    if (!indice || !isMunicipalSpreadsheetSource(source)) continue;
    if (!source.snapshot?.url) {
      problemas.push(`${layer.id}: planilha sem instantâneo publicado.`);
      indices.delete(layer.id);
      continue;
    }
    const snap = await getOrLoadSpreadsheetSnapshot(source.snapshot.url);
    indice.atualizadoEm = snap.generatedAt;
    for (const [k, rotulo] of Object.entries(snap.locations))
      anotarTerritorio(k, rotulo);
    db.exec("BEGIN");
    for (const periodo of indice.periodos) {
      const pos = snap.periods.indexOf(periodo);
      if (pos < 0) continue;
      for (const [territorio, lista] of Object.entries(snap.values)) {
        const v = lista[pos];
        if (v !== null && v !== undefined)
          inserirValores(insValor, indice.id, periodo, territorio, [v], 1);
      }
    }
    db.exec("COMMIT");
  }
  console.log(`[tabelão] planilhas gravadas (${linhasValores} linhas).`);

  // Tabelas do Earth Engine, algumas de cada vez; cada uma é gravada assim que chega.
  const fila = [...tabelas.entries()];
  let proxima = 0;
  let lidas = 0;
  let somaFilaMs = 0;
  const falhas: Array<(typeof fila)[number]> = [];
  const lerEGravar = async ([
    assetId,
    { colunas, usos },
  ]: (typeof fila)[number]) => {
    const t0 = Date.now();
    const linhas = await lerTabela(assetId, colunas);
    somaFilaMs += Date.now() - t0;
    for (const { indice, source } of usos)
      gravarLinhas(db, insValor, indice, source, colunas, linhas);
  };
  const tLeitura = Date.now();
  await Promise.all(
    Array.from({ length: CONCORRENCIA }, async () => {
      while (proxima < fila.length) {
        const tabela = fila[proxima++];
        try {
          await lerEGravar(tabela);
        } catch {
          // Gravar uma tabela grande segura o processo; a resposta de outra
          // tabela que chega nesse meio-tempo pode estourar o prazo de 30 s
          // do cliente do app. Essas são lidas de novo no fim, uma por vez.
          falhas.push(tabela);
        }
        lidas += 1;
        if (lidas % 20 === 0 || lidas === fila.length) {
          console.log(
            `[tabelão] ${lidas}/${fila.length} tabelas, ${linhasValores} linhas, ${((Date.now() - tLeitura) / 1000).toFixed(0)} s`,
          );
        }
      }
    }),
  );
  for (const tabela of falhas) {
    let erro: unknown = null;
    for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
      try {
        await lerEGravar(tabela);
        erro = null;
        break;
      } catch (e) {
        erro = e;
      }
    }
    if (erro) {
      problemas.push(
        `${tabela[0]}: leitura falhou (${(erro as Error).message}); os períodos dela ficaram fora do tabelão.`,
      );
    }
  }
  if (falhas.length) {
    console.log(
      `[tabelão] ${falhas.length} tabelas lidas de novo, uma por vez, depois de estourar o prazo.`,
    );
  }
  const leituraS = (Date.now() - tLeitura) / 1000;

  // Índices, classes, períodos e territórios.
  const insIndice = db.prepare(
    "INSERT INTO indices VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insClasse = db.prepare("INSERT INTO classes VALUES (?, ?, ?)");
  const insPeriodo = db.prepare("INSERT INTO periodos VALUES (?, ?, ?)");
  const comDado = db.prepare(
    "SELECT DISTINCT periodo FROM valores WHERE indice = ? ORDER BY periodo",
  );
  db.exec("BEGIN");
  for (const i of indices.values()) {
    const periodos = (comDado.all(i.id) as Array<{ periodo: string }>).map(
      (p) => p.periodo,
    );
    if (!periodos.length) problemas.push(`${i.id}: nenhum valor gravado.`);
    insIndice.run(
      i.id,
      i.nome,
      i.descricao,
      i.categoria,
      i.escala,
      periodos[0] ?? null,
      periodos.at(-1) ?? null,
      periodos.length,
      i.tipoValor,
      i.significado,
      i.unidade,
      i.fonte,
      i.agregacao,
      i.previsao ? 1 : 0,
      i.atualizadoEm?.slice(0, 10) ?? null,
      OBSERVACOES[i.id] ?? null,
    );
    i.classes.forEach((rotulo, k) => insClasse.run(i.id, k + 1, rotulo));
    for (const p of periodos) insPeriodo.run(i.id, p, i.rotulos.get(p) ?? p);
  }
  const qtdTerritorios = montarTerritorios(db);
  const geradoEm = new Date().toISOString();
  const insMeta = db.prepare("INSERT INTO metadados VALUES (?, ?)");
  insMeta.run("gerado_em", geradoEm);
  insMeta.run(
    "fonte",
    "Tabelas estatísticas do Earth Engine e instantâneos de planilha do catálogo do SEDES (as mesmas fontes do relatório do site).",
  );
  insMeta.run("tabelas_earth_engine", String(fila.length));
  insMeta.run("leitura_earth_engine_s", leituraS.toFixed(0));
  insMeta.run("fila_earth_engine_s", (somaFilaMs / 1000).toFixed(0));
  db.exec("COMMIT");

  console.log("[tabelão] criando índices de busca…");
  db.exec(`
    CREATE INDEX valores_por_territorio ON valores (territorio, indice, periodo);
    CREATE INDEX territorios_por_nome ON territorios (nome_sem_acento);
    CREATE INDEX territorios_por_tipo ON territorios (tipo, uf);
    CREATE VIEW valores_com_nomes AS
      SELECT v.indice, v.periodo, v.ano, v.mes, v.territorio,
             t.nome AS nome_territorio, t.tipo AS tipo_territorio, t.uf,
             v.classe, c.rotulo AS rotulo_classe, v.valor
      FROM valores v
      JOIN territorios t ON t.codigo = v.territorio
      LEFT JOIN classes c ON c.indice = v.indice AND c.ordem = v.classe;
    ANALYZE;
  `);
  db.close();
  renameSync(temporario, SAIDA);

  console.log(
    `[tabelão] ${indices.size} índices, ${qtdTerritorios} territórios, ${linhasValores} valores em ${SAIDA}.\n` +
      `[tabelão] Earth Engine: ${fila.length} tabelas lidas em ${leituraS.toFixed(0)} s (${(somaFilaMs / 1000).toFixed(0)} s somados de vaga na fila). Total ${((Date.now() - inicio) / 1000).toFixed(0)} s.`,
  );
  if (problemas.length) {
    console.log(`[tabelão] ${problemas.length} avisos:`);
    for (const p of problemas.slice(0, 60)) console.log(`  - ${p}`);
    if (problemas.length > 60)
      console.log(`  … e mais ${problemas.length - 60}.`);
  }
  if (existsSync(temporario)) rmSync(temporario);
}

main().then(
  // Os caches do app deixam timers abertos; o processo termina aqui.
  () => process.exit(0),
  (e: unknown) => {
    console.error("[tabelão] falhou:", e);
    process.exit(1);
  },
);
