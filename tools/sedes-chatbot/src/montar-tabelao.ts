/**
 * Monta o tabelão do chatbot (data/sedes.sqlite) a partir do SQLite antigo do
 * site (data/runtime/sap-analytics.sqlite, gerado em 24/07/2026).
 *
 * O arquivo antigo é aberto só para leitura e nunca é alterado. O novo é
 * escrito num arquivo temporário e renomeado no fim, então uma falha no meio
 * não deixa um tabelão pela metade.
 *
 * Uso: npm run tabelao
 *   SEDES_SQLITE_ANTIGO=/caminho/sap-analytics.sqlite  (opcional)
 */
import { DatabaseSync } from "node:sqlite";
import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  mkdirSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { INDICES } from "./indices.ts";
import { semAcento } from "./texto.ts";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PACOTE = path.resolve(AQUI, "..");
const REPO = path.resolve(PACOTE, "../..");
const ANTIGO =
  process.env.SEDES_SQLITE_ANTIGO ??
  path.join(REPO, "data/runtime/sap-analytics.sqlite");
const RECORTES = path.join(REPO, "src/data/municipalityTerritories.json");
const SAIDA = path.join(PACOTE, "data/sedes.sqlite");

// O site mudou a chave do Semiárido depois de julho; o relatório só aceita a nova.
const CHAVE_NOVA: Record<string, string> = {
  "5_semiarido-sim": "5_semiarido-semiarido-total",
};
// Áreas operacionais das lagoas Mirim e dos Patos: têm código IBGE, mas não são municípios.
const LAGOAS = new Set(["4300001", "4300002"]);
const REGIAO_POR_DIGITO: Record<string, string> = {
  "1": "Norte",
  "2": "Nordeste",
  "3": "Sudeste",
  "4": "Sul",
  "5": "Centro-Oeste",
};
const BIOMA: Record<string, string> = {
  "3_bioma-amazonia": "Amazônia",
  "3_bioma-caatinga": "Caatinga",
  "3_bioma-cerrado": "Cerrado",
  "3_bioma-mata-atlantica": "Mata Atlântica",
  "3_bioma-pampa": "Pampa",
  "3_bioma-pantanal": "Pantanal",
};

function tipoDoGrupo(codigo: string) {
  if (codigo.startsWith("2_")) return "regiao";
  if (codigo.startsWith("3_")) return "bioma";
  if (codigo.startsWith("4_")) return "asd";
  if (codigo.startsWith("5_")) return "semiarido";
  return "grupo";
}

function main() {
  if (!existsSync(ANTIGO)) {
    throw new Error(
      `Não achei o SQLite antigo em ${ANTIGO}. Aponte SEDES_SQLITE_ANTIGO para ele.`,
    );
  }
  const antigo = new DatabaseSync(ANTIGO, { readOnly: true });
  const recortes = JSON.parse(readFileSync(RECORTES, "utf8"))
    .municipalities as Record<string, string[]>;

  mkdirSync(path.dirname(SAIDA), { recursive: true });
  const temporario = `${SAIDA}.${process.pid}.tmp`;
  rmSync(temporario, { force: true });
  const db = new DatabaseSync(temporario);
  db.exec(`
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    PRAGMA cache_size = -32000;
    PRAGMA temp_store = FILE;

    CREATE TABLE metadados (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);

    CREATE TABLE indices (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT NOT NULL,
      categoria TEXT NOT NULL,
      escala_temporal TEXT NOT NULL,
      primeiro_periodo TEXT NOT NULL,
      ultimo_periodo TEXT NOT NULL,
      qtd_periodos INTEGER NOT NULL,
      tipo_valor TEXT NOT NULL,
      significado_valor TEXT NOT NULL,
      unidade TEXT NOT NULL,
      id_no_relatorio TEXT,
      observacao TEXT NOT NULL
    );

    CREATE TABLE classes (
      indice TEXT NOT NULL REFERENCES indices(id),
      ordem INTEGER NOT NULL,
      rotulo TEXT NOT NULL,
      PRIMARY KEY (indice, ordem)
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

  // --- territórios -------------------------------------------------------
  const regiaoDaUf = new Map<string, string>();
  const territorios = antigo
    .prepare("SELECT code, type, name, uf FROM territories")
    .all() as Array<{
    code: string;
    type: string;
    name: string;
    uf: string | null;
  }>;
  for (const t of territorios) {
    if (t.type === "municipality" && t.uf) {
      regiaoDaUf.set(t.uf, REGIAO_POR_DIGITO[t.code[0]]);
    }
  }
  const insTerr = db.prepare(
    "INSERT INTO territorios VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const t of territorios) {
    const codigo = CHAVE_NOVA[t.code] ?? t.code;
    let tipo: string;
    let nome = t.name;
    const uf: string | null = t.uf ? t.uf.toUpperCase() : null;
    let regiao: string | null = null;
    let bioma: string | null = null;
    let semiarido: number | null = null;
    let asd: number | null = null;
    if (t.type === "municipality") {
      tipo = LAGOAS.has(t.code) ? "lagoa" : "municipio";
      nome = t.name.replace(/ - [A-Z]{2}$/u, "");
      regiao = REGIAO_POR_DIGITO[t.code[0]];
      const grupos = recortes[t.code] ?? [];
      bioma = grupos.map((g) => BIOMA[g]).find(Boolean) ?? null;
      semiarido = grupos.includes("5_semiarido-semiarido-total") ? 1 : 0;
      asd = grupos.includes("4_asd-asd-entorno") ? 1 : 0;
    } else if (t.type === "state") {
      tipo = "estado";
      regiao = t.uf ? (regiaoDaUf.get(t.uf) ?? null) : null;
    } else if (t.type === "country") {
      tipo = "pais";
    } else {
      tipo = tipoDoGrupo(t.code);
      if (codigo === "5_semiarido-semiarido-total") nome = "Semiárido";
      if (codigo === "2_regiao-centro-oeste") nome = "Centro-Oeste";
    }
    insTerr.run(
      codigo,
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

  // --- índices e classes -------------------------------------------------
  const camadas = antigo
    .prepare(
      `SELECT l.id, l.fallback_description AS descricao, l.category, l.time_scale,
              MIN(p.period) AS primeiro, MAX(p.period) AS ultimo, COUNT(*) AS n
       FROM layers l JOIN periods p ON p.layer_id = l.id
       GROUP BY l.id ORDER BY l.id`,
    )
    .all() as Array<Record<string, string | number | null>>;
  const insIndice = db.prepare(
    "INSERT INTO indices VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const c of camadas) {
    const info = INDICES[c.id as string];
    if (!info) throw new Error(`Índice sem descrição em indices.ts: ${c.id}`);
    insIndice.run(
      c.id as string,
      info.nome,
      String(c.descricao ?? "").trim(),
      String(c.category),
      String(c.time_scale ?? "Pontual"),
      String(c.primeiro),
      String(c.ultimo),
      Number(c.n),
      info.tipo_valor,
      info.significado_valor,
      info.unidade,
      info.id_no_relatorio,
      info.observacao,
    );
  }
  const insClasse = db.prepare("INSERT INTO classes VALUES (?, ?, ?)");
  for (const row of antigo
    .prepare("SELECT layer_id, class_index, label FROM layer_classes")
    .all() as Array<{ layer_id: string; class_index: number; label: string }>) {
    insClasse.run(row.layer_id, row.class_index + 1, row.label.trim());
  }

  // --- valores (formato longo) -------------------------------------------
  // Escala: nos períodos com values_scale = 10, estados e Brasil vieram do
  // Contentful antigo em décimos de ponto percentual (as classes somam ~1000);
  // municípios e recortes já estão em % (somam 100). Por isso só estados e
  // Brasil são divididos. Conferido contra o relatório do site.
  const tipoAntigo = new Map(territorios.map((t) => [t.code, t.type]));
  const insValor = db.prepare(
    "INSERT INTO valores VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const linhas = antigo
    .prepare(
      `SELECT o.layer_id, o.period, o.territory_code, o.values_json, p.values_scale
       FROM observations o
       JOIN periods p ON p.layer_id = o.layer_id AND p.period = o.period
       ORDER BY o.layer_id, o.period, o.territory_code`,
    )
    .iterate() as Iterable<{
    layer_id: string;
    period: string;
    territory_code: string;
    values_json: string;
    values_scale: number;
  }>;

  let lidas = 0;
  let semDado = 0;
  let gravadas = 0;
  db.exec("BEGIN");
  for (const o of linhas) {
    lidas += 1;
    const valores = JSON.parse(o.values_json) as Array<number | null>;
    const info = INDICES[o.layer_id];
    if (info.zero_e_sem_dado && valores.every((v) => !v)) {
      semDado += 1;
      continue;
    }
    const tipo = tipoAntigo.get(o.territory_code);
    const escala = tipo === "state" || tipo === "country" ? o.values_scale : 1;
    const [ano, mes] = o.period.split("-").map(Number);
    const territorio = CHAVE_NOVA[o.territory_code] ?? o.territory_code;
    valores.forEach((v, i) => {
      insValor.run(
        o.layer_id,
        o.period,
        ano,
        mes ?? null,
        territorio,
        i + 1,
        Math.round(((v ?? 0) / escala) * 100) / 100,
      );
      gravadas += 1;
    });
    if (lidas % 200_000 === 0) {
      db.exec("COMMIT; BEGIN");
      console.error(`  ${lidas.toLocaleString("pt-BR")} observações lidas…`);
    }
  }
  db.exec("COMMIT");

  const meta = antigo
    .prepare("SELECT dataset_version, generated_at FROM release_metadata")
    .get() as { dataset_version: string; generated_at: string };
  const insMeta = db.prepare("INSERT INTO metadados VALUES (?, ?)");
  insMeta.run("data_dos_dados", meta.generated_at);
  insMeta.run("versao_dos_dados", meta.dataset_version);
  insMeta.run(
    "origem",
    "data/runtime/sap-analytics.sqlite (snapshot antigo do site)",
  );
  insMeta.run("montado_em", new Date().toISOString());
  insMeta.run("observacoes_sem_dado_descartadas", String(semDado));

  console.error("Criando índices de busca…");
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
      JOIN classes c ON c.indice = v.indice AND c.ordem = v.classe;
    ANALYZE;
  `);
  db.close();
  antigo.close();
  renameSync(temporario, SAIDA);
  console.log(
    JSON.stringify(
      {
        saida: SAIDA,
        observacoes: lidas,
        sem_dado_descartadas: semDado,
        linhas_valores: gravadas,
      },
      null,
      2,
    ),
  );
}

main();
