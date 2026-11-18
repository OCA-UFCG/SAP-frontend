/**
 * Acrescenta ao tabelão que já existe (data/sedes.sqlite) o que as tabelas do
 * Earth Engine trazem e o montar-tabelao.ts não grava:
 *
 *   - territorios.area_km2: a área de cada território (coluna de área total
 *     das tabelas estatísticas), para responder "quantos km²" a partir da % da
 *     área;
 *   - medias(indice, periodo, territorio, media, mediana, minimo, maximo): o
 *     valor médio do índice no território, para os índices cuja tabela traz
 *     essas colunas (previsões em mm e °C, aridez, PPB, carbono). O site só
 *     mostra a faixa ("10 a 100 mm"); a média responde "quantos mm". Duas
 *     conversões, para a média sair na unidade das classes do índice: a
 *     temperatura média do CPTEC vem em kelvin (vira °C) e a PPB vem com o
 *     fator 0,0001 do produto de satélite (vira kg C/m²).
 *
 * Não relê o que já está no tabelão e não muda nenhum valor existente: os
 * gabaritos de perguntas.md continuam valendo. Só entram médias de períodos
 * que o tabelão já tem.
 *
 * Roda na raiz do repositório, com o .env do site:
 *   npm --prefix tools/sedes-chatbot run complementos
 * Depois de um `npm run tabelao`, rode de novo.
 * Variáveis opcionais:
 *   SEDES_COMPLEMENTOS_PLANO=1   só mostra as colunas de cada índice, sem gravar
 *   SEDES_CONCORRENCIA_EE=4      quantas tabelas são lidas ao mesmo tempo
 */
import nextEnv from "@next/env";
import ee from "@google/earthengine";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveGeeStatisticsSource,
  type GeeFeatureCollectionStatisticsSource,
} from "@/contracts/geeStatistics";
import { buildSpatialLocationKey } from "@/contracts/spatialLocationKey.mjs";
import {
  evaluateGeeObject,
  initializeGee,
} from "@/infrastructure/earth-engine/client";
import { describeGeeStatisticsMunicipalTables } from "@/repositories/platform/geeStatisticsRepository";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import { semAcento } from "../texto.ts";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PACOTE = path.resolve(AQUI, "../..");
const REPO = path.resolve(PACOTE, "../..");
const TABELAO =
  process.env.SEDES_TABELAO ?? path.join(PACOTE, "data/sedes.sqlite");
const SO_PLANO = process.env.SEDES_COMPLEMENTOS_PLANO === "1";
const CONCORRENCIA = Number(process.env.SEDES_CONCORRENCIA_EE ?? 4);

type Linha = Record<string, unknown>;

/** Colunas de média, mediana, mínimo e máximo, pelos nomes que os assets usam. */
const COLUNAS_ESCALARES: Record<
  "media" | "mediana" | "minimo" | "maximo",
  RegExp
> = {
  media: /^(mean|media|média)(_.+)?$/iu,
  mediana: /^(median|mediana)(_.+)?$/iu,
  minimo: /^(min|minimo|mínimo)(_.+)?$/iu,
  maximo: /^(max|maximo|máximo)(_.+)?$/iu,
};

async function emParalelo<T>(itens: T[], fn: (x: T) => Promise<void>) {
  let proximo = 0;
  await Promise.all(
    Array.from({ length: CONCORRENCIA }, async () => {
      while (proximo < itens.length) await fn(itens[proximo++]);
    }),
  );
}

async function colunasDe(assetId: string): Promise<string[]> {
  const r = await evaluateGeeObject<string[]>(
    ee.FeatureCollection(assetId).first().propertyNames(),
  );
  return Array.isArray(r) ? r : [];
}

async function lerColunas(assetId: string, colunas: string[]) {
  const fc = ee.FeatureCollection(assetId);
  const r = await evaluateGeeObject<{ rows?: { list?: unknown[][] } }>(
    ee.Dictionary({
      rows: fc.reduceColumns(ee.Reducer.toList(colunas.length), colunas),
    }),
  );
  const lista = r?.rows?.list;
  if (!Array.isArray(lista))
    throw new Error(`resposta inválida do Earth Engine para ${assetId}`);
  return lista.map(
    (celulas): Linha =>
      Object.fromEntries(colunas.map((c, i) => [c, celulas[i]])),
  );
}

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

/** Nome do estado sem acento → sigla minúscula, lido do próprio tabelão. */
const ESTADOS = new Map<string, string>();

/** As chaves de território de uma linha: o Brasil e as UFs saem pela sigla. */
function chaveDoTerritorio(
  source: GeeFeatureCollectionStatisticsSource,
  linha: Linha,
): string | null {
  const p = source.properties;
  const nivel = String(linha[p.level]);
  try {
    if (nivel === "1_BR") return "br";
    if (nivel === "6_Estado") {
      for (const c of [p.stateCode, p.locationName]) {
        const v = String(linha[c] ?? "").trim();
        if (/^[A-Za-z]{2}$/u.test(v)) return v.toLowerCase();
        const sigla = ESTADOS.get(semAcento(v));
        if (sigla) return sigla;
      }
      return null;
    }
    if (nivel === "7_Municipio") return String(linha[p.municipalityCode]).trim();
    return buildSpatialLocationKey(nivel, linha[p.locationName]);
  } catch {
    return null;
  }
}

/** Põe a média na unidade das classes do índice (ver o cabeçalho). */
function conversaoDe(indice: string): (v: number) => number {
  if (/^previsao-temperatura-.*-media-cptec$/u.test(indice))
    return (v) => (v > 200 ? v - 273.15 : v);
  if (indice === "producao-primaria-bruta") return (v) => v * 1e-4;
  return (v) => v;
}

async function main() {
  nextEnv.loadEnvConfig(REPO);
  if (!process.env.GEE_PRIVATE_KEY)
    throw new Error("Falta GEE_PRIVATE_KEY no .env da raiz do repositório.");
  await initializeGee();
  const inicio = Date.now();

  const db = new DatabaseSync(TABELAO, { readOnly: SO_PLANO });
  const noTabelao = new Map(
    (
      db.prepare("SELECT id, qtd_periodos FROM indices").all() as Array<{
        id: string;
        qtd_periodos: number;
      }>
    ).map((i) => [i.id, i.qtd_periodos]),
  );
  for (const e of db
    .prepare("SELECT codigo, nome_sem_acento FROM territorios WHERE tipo = 'estado'")
    .all() as Array<{ codigo: string; nome_sem_acento: string }>)
    ESTADOS.set(e.nome_sem_acento, e.codigo);
  const periodosDe = db.prepare(
    "SELECT periodo FROM periodos WHERE indice = ? ORDER BY periodo",
  );

  const camadas = (await getPanelLayers()).filter(
    (l) =>
      noTabelao.has(l.id) &&
      l.statisticsSource?.kind === "gee-feature-collection",
  );

  // Plano: as tabelas de cada índice e as colunas que cada uma tem.
  type Plano = {
    id: string;
    source: GeeFeatureCollectionStatisticsSource;
    periodos: string[];
    assetIds: string[];
    colunas: string[];
    escalares: Partial<Record<keyof typeof COLUNAS_ESCALARES, string>>;
  };
  const planos: Plano[] = [];
  await emParalelo(camadas, async (layer) => {
    const source = layer.statisticsSource as GeeFeatureCollectionStatisticsSource;
    const periodos = (
      periodosDe.all(layer.id) as Array<{ periodo: string }>
    ).map((p) => p.periodo);
    try {
      const d = await describeGeeStatisticsMunicipalTables(source, periodos);
      if (!d) return;
      const colunas = await colunasDe(d.assetIds.at(-1)!);
      const declaradas = source.properties.scalarMetrics ?? {};
      const escalares: Plano["escalares"] = {};
      const achar = (k: keyof typeof COLUNAS_ESCALARES, declarada?: string) => {
        const c =
          declarada && colunas.includes(declarada)
            ? declarada
            : colunas.find((x) => COLUNAS_ESCALARES[k].test(x));
        if (c) escalares[k] = c;
      };
      achar("media", declaradas.mean);
      achar("mediana", declaradas.median);
      achar("minimo", declaradas.min);
      achar("maximo", declaradas.max);
      planos.push({
        id: layer.id,
        source,
        periodos,
        assetIds: d.assetIds,
        colunas,
        escalares,
      });
    } catch (e) {
      console.log(`[complementos] ${layer.id}: ${(e as Error).message}`);
    }
  });
  planos.sort((a, b) => a.id.localeCompare(b.id));

  if (SO_PLANO) {
    for (const p of planos) {
      const outras = p.colunas.filter(
        (c) => !/^(perc_classe_|area_ha_classe_|system:)/u.test(c),
      );
      console.log(
        `\n${p.id}: ${p.assetIds.length} tabelas, ${p.periodos.length} períodos\n  área total: ${p.source.properties.totalArea} (${p.colunas.includes(p.source.properties.totalArea) ? "existe" : "FALTA"})\n  escalares: ${JSON.stringify(p.escalares)}\n  colunas: ${outras.join(", ")}`,
      );
    }
    return;
  }

  db.exec("PRAGMA journal_mode = DELETE; PRAGMA synchronous = NORMAL;");
  const temColuna = (tabela: string, coluna: string) =>
    (
      db.prepare(`PRAGMA table_info(${tabela})`).all() as Array<{
        name: string;
      }>
    ).some((c) => c.name === coluna);
  if (!temColuna("territorios", "area_km2"))
    db.exec("ALTER TABLE territorios ADD COLUMN area_km2 REAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS medias (
      indice TEXT NOT NULL,
      periodo TEXT NOT NULL,
      territorio TEXT NOT NULL,
      media REAL,
      mediana REAL,
      minimo REAL,
      maximo REAL,
      PRIMARY KEY (indice, periodo, territorio)
    ) WITHOUT ROWID;
  `);

  // --- área: de um índice que tem todos os territórios numa tabela só ---
  const paraArea =
    planos.find((p) => p.id === "solos-do-brasil-ibge") ??
    planos.find((p) => p.assetIds.length === 1) ??
    planos[0];
  {
    const p = paraArea.source.properties;
    const linhas = await lerColunas(paraArea.assetIds.at(-1)!, [
      p.level,
      p.locationName,
      p.municipalityCode,
      p.stateCode,
      p.totalArea,
    ]);
    const gravar = db.prepare(
      "UPDATE territorios SET area_km2 = ? WHERE codigo = ?",
    );
    let n = 0;
    db.exec("BEGIN");
    for (const l of linhas) {
      const chave = chaveDoTerritorio(paraArea.source, l);
      const ha = Number(l[p.totalArea]);
      if (!chave || !Number.isFinite(ha) || ha <= 0) continue;
      n += Number(gravar.run(Math.round(ha) / 100, chave).changes);
    }
    db.exec("COMMIT");
    console.log(
      `[complementos] área de ${n} territórios, lida de ${paraArea.id}.`,
    );
  }

  // --- médias ---
  // Nas previsões por probabilidade a coluna é a média de uma chance com
  // sinal (abaixo/acima do normal), que não tem leitura simples: fica de fora.
  const comMedia = planos.filter(
    (p) => p.escalares.media && !/probabilidade/u.test(p.id),
  );
  const insMedia = db.prepare(
    "INSERT OR REPLACE INTO medias VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const tabelas: Array<{ plano: Plano; assetId: string }> = comMedia.flatMap(
    (plano) => plano.assetIds.map((assetId) => ({ plano, assetId })),
  );
  console.log(
    `[complementos] médias: ${comMedia.length} índices, ${tabelas.length} tabelas.`,
  );
  let lidas = 0;
  let gravadas = 0;
  const falhas: typeof tabelas = [];
  const lerEGravar = async ({ plano, assetId }: (typeof tabelas)[number]) => {
    const p = plano.source.properties;
    const esc = plano.escalares;
    const temporal =
      plano.source.periodGranularity === "year" ? p.year : p.date;
    const colunas = [
      ...new Set(
        [
          p.level,
          p.locationName,
          p.municipalityCode,
          p.stateCode,
          temporal,
          esc.media,
          esc.mediana,
          esc.minimo,
          esc.maximo,
        ].filter((c): c is string => Boolean(c)),
      ),
    ];
    const linhas = await lerColunas(assetId, colunas);
    const periodos = new Set(plano.periodos);
    const converter = conversaoDe(plano.id);
    const n = (c?: string, l?: Linha) => {
      const v = c && l ? Number(l[c]) : NaN;
      return Number.isFinite(v) ? Math.round(converter(v) * 1e4) / 1e4 : null;
    };
    db.exec("BEGIN");
    for (const l of linhas) {
      const periodo = chaveDoPeriodo(plano.source, l);
      if (!periodos.has(periodo)) continue;
      // A mesma regra do site para tabelas com vários períodos.
      resolveGeeStatisticsSource(plano.source, periodo);
      const chave = chaveDoTerritorio(plano.source, l);
      const media = n(esc.media, l);
      if (!chave || media === null) continue;
      insMedia.run(
        plano.id,
        periodo,
        chave,
        media,
        n(esc.mediana, l),
        n(esc.minimo, l),
        n(esc.maximo, l),
      );
      gravadas += 1;
    }
    db.exec("COMMIT");
  };
  await emParalelo(tabelas, async (t) => {
    try {
      await lerEGravar(t);
    } catch {
      falhas.push(t);
    }
    lidas += 1;
    if (lidas % 20 === 0 || lidas === tabelas.length)
      console.log(
        `[complementos] ${lidas}/${tabelas.length} tabelas, ${gravadas} médias, ${((Date.now() - inicio) / 1000).toFixed(0)} s`,
      );
  });
  for (const t of falhas) {
    try {
      await lerEGravar(t);
    } catch (e) {
      console.log(
        `[complementos] ${t.assetId}: leitura falhou (${(e as Error).message}).`,
      );
    }
  }

  db.prepare("INSERT OR REPLACE INTO metadados VALUES (?, ?)").run(
    "complementos_em",
    new Date().toISOString(),
  );
  db.exec("ANALYZE medias");
  db.close();
  console.log(
    `[complementos] pronto em ${((Date.now() - inicio) / 1000).toFixed(0)} s: ${gravadas} médias de ${comMedia.length} índices.`,
  );
}

main().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error("[complementos] falhou:", e);
    process.exit(1);
  },
);
