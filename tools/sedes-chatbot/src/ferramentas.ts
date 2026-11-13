/**
 * As ferramentas do bot do SEDES, todas só de leitura: o tabelão é aberto em
 * modo read-only e o relatório é um GET na rota que o site já tem.
 *
 * Usadas pelos dois motores: o servidor MCP (servidor.ts, para o claude da
 * linha de comando) e o motor da API (chat/motor-api.ts, para o beta).
 *
 * Variáveis de ambiente:
 *   SEDES_BASE_URL   base do site para o relatório (padrão http://localhost:3000)
 *   SEDES_TABELAO    caminho do tabelão (padrão data/sedes.sqlite)
 *   SEDES_SITE_URL   site dos links "Ver no SEDES" (padrão https://sedes.oca.ufcg.edu.br)
 */
import { fork, type ChildProcess } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { OBSERVACOES } from "./observacoes.ts";
import {
  COLUNAS_DA_TABELA,
  comPriorizacao,
  priorizarMunicipios,
} from "./priorizacao.ts";
import { resumirRelatorio } from "./relatorio.ts";
import { semAcento } from "./texto.ts";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const TABELAO =
  process.env.SEDES_TABELAO ?? path.resolve(AQUI, "../data/sedes.sqlite");
const BASE_URL = (
  process.env.SEDES_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");
const SITE_URL = (
  process.env.SEDES_SITE_URL ?? "https://sedes.oca.ufcg.edu.br"
).replace(/\/$/, "");
const CONHECIMENTO = path.resolve(AQUI, "../conhecimento");
const LIMITE_LINHAS = 200;
const LIMITE_GRAFICO = 60;
const PRAZO_SQL_MS = 10_000;
const PRAZO_RELATORIO_MS = 90_000;
// Consultas ao mesmo tempo. Cada uma ocupa um núcleo enquanto roda; a VM do
// beta tem dois e divide com o site.
const SQL_SIMULTANEAS = Number(process.env.SEDES_SQL_SIMULTANEAS ?? 2);

/** O que muda de uma pergunta para outra e as ferramentas precisam saber. */
export type Contexto = {
  /** Cookie de sessão de quem perguntou, repassado ao relatório do site. */
  cookieSessao?: string;
  /** E-mail de quem perguntou (só com login). */
  email?: string;
};

export type Ferramenta = {
  nome: string;
  titulo: string;
  descricao: string;
  entrada: z.ZodRawShape;
  executar: (args: never, ctx: Contexto) => Promise<string>;
};

if (!existsSync(TABELAO)) {
  throw new Error(
    `Tabelão não encontrado em ${TABELAO}. Rode "npm run tabelao".`,
  );
}
const db = new DatabaseSync(TABELAO, { readOnly: true });
export const GERADO_EM = (
  db.prepare("SELECT valor FROM metadados WHERE chave = 'gerado_em'").get() as {
    valor: string;
  }
).valor;
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const RODAPE = `\n(Fonte: tabelão do SEDES, gerado em ${dataBr(GERADO_EM)} das mesmas tabelas do site; a data de cada índice está em listar_indices.)`;

function tabela(colunas: string[], linhas: Array<Record<string, unknown>>) {
  const cel = (v: unknown) => {
    if (v === null || v === undefined) return "";
    // 3 casas: com 2, 44,947 virava 44,95 e o modelo arredondava de novo para 45,0.
    if (typeof v === "number") return String(Math.round(v * 1000) / 1000);
    return String(v).replace(/\s+/g, " ").slice(0, 300);
  };
  return [
    colunas.join(" | "),
    ...linhas.map((l) => colunas.map((c) => cel(l[c])).join(" | ")),
  ].join("\n");
}

// --- SQL em processos filhos, mortos se passarem do prazo -------------------
// O node:sqlite não interrompe uma consulta em andamento. Cada consulta roda
// num processo filho; o que passa do prazo é morto sem levar as consultas de
// outras pessoas junto, e as que chegam com todos ocupados esperam a vez.

type RespostaSql =
  | {
      ok: true;
      colunas: string[];
      linhas: Array<Record<string, unknown>>;
      truncado: boolean;
    }
  | { ok: false; erro: string };

const livres: ChildProcess[] = [];
const vivos = new Set<ChildProcess>();
const fila: Array<() => void> = [];
let ocupados = 0;
let proximoId = 1;

function novoFilho() {
  // O node 24 lê TypeScript sem o tsx; poupa memória em cada filho.
  const filho = fork(path.join(AQUI, "sql-filho.ts"), [TABELAO], {
    execArgv: ["--no-warnings"],
    stdio: ["ignore", "ignore", "inherit", "ipc"],
  });
  vivos.add(filho);
  filho.on("exit", () => {
    vivos.delete(filho);
    const i = livres.indexOf(filho);
    if (i >= 0) livres.splice(i, 1);
  });
  return filho;
}

async function vaga() {
  if (ocupados >= SQL_SIMULTANEAS) await new Promise<void>((r) => fila.push(r));
  ocupados += 1;
}

function liberarVaga() {
  ocupados -= 1;
  fila.shift()?.();
}

async function executarSql(sql: string): Promise<RespostaSql> {
  await vaga();
  const filho = livres.pop() ?? novoFilho();
  const id = proximoId++;
  try {
    return await new Promise<RespostaSql>((resolve) => {
      const prazo = setTimeout(() => {
        filho.off("message", ouvir);
        filho.kill("SIGKILL");
        resolve({
          ok: false,
          erro: `A consulta passou de ${PRAZO_SQL_MS / 1000} s e foi cancelada. Filtre por indice e periodo (são as colunas indexadas) e evite varrer todos os períodos de um índice mensal.`,
        });
      }, PRAZO_SQL_MS);
      function ouvir(msg: RespostaSql & { id: number }) {
        if (msg.id !== id) return;
        clearTimeout(prazo);
        filho.off("message", ouvir);
        if (filho.connected) livres.push(filho);
        resolve(msg);
      }
      filho.on("message", ouvir);
      filho.send({ id, sql, limite: LIMITE_LINHAS });
    });
  } finally {
    liberarVaga();
  }
}

/** Encerra os processos de SQL (o servidor faz isso sozinho ao sair). */
export function encerrarFerramentas() {
  for (const f of vivos) f.kill("SIGKILL");
}
process.on("exit", encerrarFerramentas);

function validarSql(sql: string): string | null {
  const limpo = sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .trim()
    .replace(/;\s*$/, "");
  if (!/^(select|with)\b/i.test(limpo))
    return "Só são aceitas consultas que começam com SELECT ou WITH.";
  if (limpo.includes(";"))
    return "Mande uma consulta por vez, sem ';' no meio.";
  // O banco já abre em modo só leitura; isto só barra o que sairia do tabelão.
  if (
    /\b(attach|detach|pragma|vacuum)\b/i.test(limpo.replace(/'[^']*'/g, "''"))
  )
    return "A consulta contém um comando que não é permitido aqui.";
  return null;
}

// --- ferramentas ------------------------------------------------------------

const listarIndices: Ferramenta = {
  nome: "listar_indices",
  titulo: "Catálogo de índices do SEDES",
  descricao:
    "Lista os índices do tabelão do SEDES (os mesmos do relatório do site), sem a descrição longa (para ela, use detalhar_indice): id, nome, categoria, escala temporal, primeiro e último período, data de atualização, o que o valor significa, unidade, como estados e recortes são calculados, ressalvas e as classes de cada um. Chame antes de escrever SQL, para saber o id do índice e a ordem das classes.",
  entrada: {},
  async executar() {
    const indices = db
      .prepare(
        "SELECT id, nome, categoria, escala_temporal, primeiro_periodo, ultimo_periodo, qtd_periodos, tipo_valor, significado_valor, unidade, agregacao, previsao, atualizado_em, observacao FROM indices ORDER BY categoria, previsao, nome",
      )
      .all() as Array<Record<string, string | number | null>>;
    const classes = db.prepare(
      "SELECT ordem, rotulo FROM classes WHERE indice = ? ORDER BY ordem",
    );
    const partes = [
      `Tabelão gerado em ${dataBr(GERADO_EM)}, copiando as mesmas tabelas que o relatório do site usa. "Atualizado em" é quando a fonte do índice foi publicada pela última vez.`,
      "",
    ];
    for (const i of indices) {
      const cls = (
        classes.all(i.id as string) as Array<{ ordem: number; rotulo: string }>
      )
        .map((c) => `${c.ordem}=${c.rotulo}`)
        .join(", ");
      partes.push(
        `## ${i.nome} (id: ${i.id})${i.previsao ? " [PREVISÃO]" : ""}`,
        `Categoria: ${i.categoria}. Escala: ${i.escala_temporal}. Períodos: ${i.primeiro_periodo} a ${i.ultimo_periodo} (${i.qtd_periodos}). Atualizado em: ${i.atualizado_em ? dataBr(String(i.atualizado_em)) : "?"}.`,
        `Valor: ${i.significado_valor} Tipo: ${i.tipo_valor}.`,
        `Recortes: ${i.agregacao}`,
        ...(i.tipo_valor === "distribuicao"
          ? [`Classes (coluna classe): ${cls}`]
          : []),
        ...(OBSERVACOES[String(i.id)]
          ? [`Observação: ${OBSERVACOES[String(i.id)]}`]
          : []),
        "",
      );
    }
    return partes.join("\n");
  },
};

const AGREGACAO_CURTA: Array<[RegExp, string]> = [
  [/valor próprio/, "cada recorte tem valor próprio"],
  [/MÉDIA SIMPLES/, "estados e recortes = média simples dos municípios"],
  [/SOMA/, "estados e recortes = soma dos municípios"],
];

const MESES = "jan fev mar abr mai jun jul ago set out nov dez".split(" ");

/**
 * O trimestre que começa no mês do período, como o site mostra nas previsões
 * sazonais (src/utils/seasonalPeriod.ts): "2026-11" → "nov/2026 a jan/2027".
 */
export function trimestreDe(periodo: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (!m) return periodo;
  const ano = Number(m[1]);
  const mes = Number(m[2]) - 1;
  const fim = mes + 2;
  return `${MESES[mes]}/${ano} a ${MESES[fim % 12]}/${ano + Math.floor(fim / 12)}`;
}

/**
 * O catálogo de listar_indices em forma curta, para ir no prompt do sistema:
 * com ele o modelo não precisa chamar listar_indices antes de cada consulta.
 * Só muda quando o tabelão é gerado de novo, então fica no cache do prompt.
 */
export function catalogoResumido() {
  const indices = db
    .prepare(
      "SELECT id, nome, categoria, escala_temporal, primeiro_periodo, ultimo_periodo, qtd_periodos, tipo_valor, significado_valor, agregacao, previsao, atualizado_em FROM indices ORDER BY previsao, categoria, nome",
    )
    .all() as Array<Record<string, string | number | null>>;
  const classes = db.prepare(
    "SELECT ordem, rotulo FROM classes WHERE indice = ? ORDER BY ordem",
  );
  const periodos = db.prepare(
    "SELECT periodo FROM periodos WHERE indice = ? ORDER BY periodo",
  );
  const linhas = [
    `Tabelão gerado em ${dataBr(GERADO_EM)}. Cada linha: id — nome. Escala, períodos, data de atualização no site, o que o valor é, como estados e recortes são calculados, classes (coluna classe). "% da área" = porcentagem da área do território em cada classe; as classes somam 100%.`,
  ];
  let grupo = "";
  for (const i of indices) {
    const g = i.previsao ? "Previsões (não são medições)" : String(i.categoria);
    if (g !== grupo) linhas.push("", `### ${g}`);
    grupo = g;
    const n = Number(i.qtd_periodos);
    // Nas previsões trimestrais o período é o mês em que o trimestre começa.
    const trimestral =
      Boolean(i.previsao) && /trimestral/i.test(String(i.nome));
    // Com poucos períodos, "2010 a 2023" esconde que só há 2010, 2020 e 2023.
    const per =
      n <= 8
        ? (periodos.all(i.id as string) as Array<{ periodo: string }>)
            .map((p) =>
              trimestral
                ? `${p.periodo} (${trimestreDe(p.periodo)})`
                : p.periodo,
            )
            .join(", ")
        : `${i.primeiro_periodo} a ${i.ultimo_periodo} (${n})`;
    const valor =
      i.tipo_valor === "distribuicao"
        ? "% da área"
        : String(i.significado_valor).replace(
            / Um valor só por território e período \(classe = 1\)\./,
            " (valor único, classe = 1)",
          );
    const agregacao =
      AGREGACAO_CURTA.find(([re]) => re.test(String(i.agregacao)))?.[1] ??
      String(i.agregacao);
    const cls =
      i.tipo_valor === "distribuicao"
        ? ` Classes: ${(classes.all(i.id as string) as Array<{ ordem: number; rotulo: string }>).map((c) => `${c.ordem}=${c.rotulo}`).join(", ")}.`
        : "";
    const obs = OBSERVACOES[String(i.id)]
      ? ` Observação: ${OBSERVACOES[String(i.id)]}`
      : "";
    linhas.push(
      `- ${i.id} — ${i.nome}. ${trimestral ? "trimestral" : i.escala_temporal}, ${per}; atualizado ${i.atualizado_em ? dataBr(String(i.atualizado_em)) : "?"}. ${valor}; ${agregacao}.${cls}${obs}`,
    );
  }
  return linhas.join("\n");
}

const detalharIndice: Ferramenta = {
  nome: "detalhar_indice",
  titulo: "Detalhes de um índice",
  descricao:
    'Devolve a descrição completa de um índice como está no catálogo do site (o que mede, metodologia, fonte), mais classes, períodos, data de atualização e ressalvas. Use em perguntas conceituais ("o que é o CDI?", "como é calculado?") antes de dizer que o catálogo não explica algo.',
  entrada: {
    id: z.string().describe("Id do índice, como aparece em listar_indices"),
  },
  async executar({ id }: { id: string }) {
    const i = db
      .prepare(
        "SELECT id, nome, descricao, categoria, escala_temporal, primeiro_periodo, ultimo_periodo, qtd_periodos, significado_valor, agregacao, previsao, atualizado_em FROM indices WHERE id = ?",
      )
      .get(id) as Record<string, string | number | null> | undefined;
    if (!i)
      return `Não existe índice com id "${id}". Use listar_indices para ver os ids.`;
    const cls = (
      db
        .prepare(
          "SELECT ordem, rotulo FROM classes WHERE indice = ? ORDER BY ordem",
        )
        .all(id) as Array<{ ordem: number; rotulo: string }>
    )
      .map((c) => `${c.ordem}=${c.rotulo}`)
      .join(", ");
    return [
      `## ${i.nome} (id: ${i.id})${i.previsao ? " [PREVISÃO]" : ""}`,
      `Descrição no catálogo do site: ${i.descricao || "(vazia)"}`,
      `Categoria: ${i.categoria}. Escala: ${i.escala_temporal}. Períodos: ${i.primeiro_periodo} a ${i.ultimo_periodo} (${i.qtd_periodos}). Atualizado em: ${i.atualizado_em ? dataBr(String(i.atualizado_em)) : "?"}.`,
      `Valor: ${i.significado_valor}`,
      `Recortes: ${i.agregacao}`,
      `Classes: ${cls}`,
      ...(OBSERVACOES[id] ? [`Observação: ${OBSERVACOES[id]}`] : []),
    ].join("\n");
  },
};

const buscarTerritorio: Ferramenta = {
  nome: "buscar_territorio",
  titulo: "Buscar território pelo nome",
  descricao:
    "Procura municípios, estados, regiões, biomas e outros recortes pelo nome, sem diferenciar acento ou maiúscula. Devolve TODOS os homônimos com UF; se houver mais de um município com o nome, pergunte ao usuário qual é (ou liste as opções). O campo codigo é o que se usa na coluna valores.territorio e na ferramenta relatorio_territorio.",
  entrada: {
    nome: z
      .string()
      .min(2)
      .describe(
        "Nome ou parte do nome, ex.: 'Santa Luzia', 'campina grande', 'caatinga', 'Paraíba'",
      ),
    uf: z
      .string()
      .length(2)
      .optional()
      .describe("Sigla da UF para filtrar, ex.: 'PB'"),
  },
  async executar({ nome, uf }: { nome: string; uf?: string }) {
    const alvo = semAcento(nome);
    const filtroUf = uf ? " AND uf = ?" : "";
    const params = uf ? [uf.toUpperCase()] : [];
    const cols = "codigo, nome, tipo, uf, regiao, bioma, semiarido";
    let linhas = db
      .prepare(
        `SELECT ${cols} FROM territorios WHERE nome_sem_acento = ?${filtroUf} ORDER BY tipo, uf`,
      )
      .all(alvo, ...params) as Array<Record<string, unknown>>;
    let modo = "nome exato";
    if (!linhas.length) {
      linhas = db
        .prepare(
          `SELECT ${cols} FROM territorios WHERE nome_sem_acento LIKE ?${filtroUf} ORDER BY length(nome), uf LIMIT 30`,
        )
        .all(`%${alvo}%`, ...params) as Array<Record<string, unknown>>;
      modo = "nome parecido";
    }
    if (!linhas.length) {
      return `Nenhum território do SEDES tem nome parecido com "${nome}"${uf ? ` na UF ${uf}` : ""}.`;
    }
    const municipios = linhas.filter((l) => l.tipo === "municipio").length;
    const aviso =
      modo === "nome exato" && municipios > 1
        ? `\nATENÇÃO: ${municipios} municípios com esse nome. Pergunte ao usuário a UF antes de responder.`
        : "";
    return `Busca por ${modo}:\n${tabela(["codigo", "nome", "tipo", "uf", "regiao", "bioma", "semiarido"], linhas)}${aviso}`;
  },
};

const ESQUEMA = `Banco SQLite só leitura (o tabelão do SEDES). Tabelas:
- indices(id, nome, descricao, categoria, escala_temporal, primeiro_periodo, ultimo_periodo, qtd_periodos, tipo_valor, significado_valor, unidade, fonte, agregacao, previsao, atualizado_em, observacao)
- classes(indice, ordem, rotulo)  -- ordem começa em 1
- periodos(indice, periodo, rotulo)  -- rotulo legível (ex.: trimestre da previsão)
- territorios(codigo, nome, nome_sem_acento, tipo, uf, regiao, bioma, semiarido, asd_entorno)
    tipo: 'municipio' | 'estado' | 'pais' | 'regiao' | 'bioma' | 'semiarido' | 'asd' | 'lagoa'
    codigo: IBGE de 7 dígitos (município), sigla minúscula ('pb') para estado, 'br', '2_regiao-nordeste', '3_bioma-caatinga', '5_semiarido-semiarido-total', '4_asd-asd-entorno', '4_asd-apenas-asd'
    uf: sigla MAIÚSCULA ('PB'). bioma: bioma predominante do município. semiarido / asd_entorno: 1 ou 0 (só municípios)
- valores(indice, periodo, ano, mes, territorio, classe, valor)  -- formato longo: uma linha por classe
    periodo: 'AAAA' (anual), 'AAAA-MM' (mensal) ou 'AAAA-MM-DD' (decendial: dias 01, 11 e 21; só o CDI).
    valor já está na unidade final (% da área, % de famílias, contagem, reais...; veja listar_indices). Valores com casas a mais: arredonde ao responder.
    Índices de valor único têm só classe = 1.
    Ao falar de uma classe, use o rótulo (rotulo_classe em valores_com_nomes), nunca o número: no Índice de Degradação da Terra a classe 1 é o "Nível 5" e a classe 5 é o "Nível 1".
    Linha ausente = sem dado para aquele território e período.
- valores_com_nomes: visão de valores com nome_territorio, tipo_territorio, uf e rotulo_classe.
- metadados(chave, valor)  -- 'gerado_em'

Desempenho: a chave é (indice, periodo, territorio, classe) e há índice em (territorio, indice, periodo). Sempre filtre por indice e, em rankings, por periodo exato ou faixa (periodo BETWEEN '2025-01' AND '2025-12'); filtrar só por ano varre a tabela inteira.
A tabela valores mistura municípios, estados e recortes: para contar ou ranquear municípios, junte com territorios e filtre t.tipo = 'municipio'.
Brasil, estados, regiões, biomas, Semiárido e ASD têm valor próprio em valores para todos os índices; use-o em vez de somar ou tirar média dos municípios.

Exemplos:
1) Distribuição de um município num mês:
   SELECT rotulo_classe, valor FROM valores_com_nomes WHERE indice='monitor-de-seca-ana' AND periodo='2026-09' AND territorio='2504009' ORDER BY classe;
2) Ranking com gráfico: municípios do Semiárido com maior % de área em seca grave ou pior no Monitor de Secas
   (grafico = {tipo:'ranking', titulo:'Seca grave ou pior no Semiárido, setembro de 2026', unidade:'% da área'}):
   SELECT t.nome || '–' || t.uf AS rotulo, SUM(v.valor) AS valor FROM valores v JOIN territorios t ON t.codigo=v.territorio
   WHERE v.indice='monitor-de-seca-ana' AND v.periodo='2026-09' AND v.classe >= 4 AND t.tipo='municipio' AND t.semiarido=1
   GROUP BY t.codigo ORDER BY valor DESC LIMIT 10;
3) Série histórica com gráfico: pobreza de um município
   (grafico = {tipo:'serie', titulo:'Pobreza total em Campina Grande–PB', unidade:'% das famílias do CadÚnico'}):
   SELECT periodo AS rotulo, valor FROM valores WHERE indice='percentual-de-pobreza-total-cadunico' AND territorio='2504009' ORDER BY periodo;
4) Contar municípios (toda contagem, média ou soma de municípios precisa do JOIN com t.tipo='municipio'; sem ele entram estados, Brasil e recortes):
   SELECT COUNT(*) FROM (SELECT v.territorio FROM valores v JOIN territorios t ON t.codigo=v.territorio
   WHERE v.indice='indice-de-degradacao-da-terra' AND v.periodo='2021' AND v.classe IN (1,2,3) AND t.tipo='municipio'
   GROUP BY v.territorio HAVING SUM(v.valor) > 50);
5) Dois índices lado a lado, mês a mês, numa consulta só (para comparar padrões; o CDI é decendial: use o decêndio do dia 21 de cada mês):
   SELECT m.periodo, m.seca AS monitor_moderada_ou_pior, c.seca AS cdi_estagios_1_a_3 FROM
   (SELECT periodo, SUM(CASE WHEN classe>=3 THEN valor ELSE 0 END) AS seca FROM valores WHERE indice='monitor-de-seca-ana' AND territorio='2504009' GROUP BY periodo) m
   LEFT JOIN (SELECT substr(periodo,1,7) AS mes, SUM(CASE WHEN classe BETWEEN 2 AND 4 THEN valor ELSE 0 END) AS seca FROM valores
   WHERE indice='indice-combinado-de-seca-cdi' AND territorio='2504009' AND periodo >= '2024-01-01' AND substr(periodo,9,2)='21' GROUP BY periodo) c
   ON c.mes=m.periodo ORDER BY m.periodo;`;

type Grafico = { tipo: "serie" | "ranking"; titulo: string; unidade?: string };

let rotulosDasClasses: Map<string, string> | undefined;

/**
 * Quando a consulta devolve a coluna classe sem o rótulo, põe o rótulo ao
 * lado. Sem ele o modelo traduz o número de cabeça pelo catálogo e às vezes
 * pega a classe vizinha (ex.: disse "100 a 200 mm" para a classe 2, que é
 * "10 a 100 mm"). O índice vem de uma coluna da consulta com ids de índices
 * ou, se não houver, do único id de índice escrito no SQL.
 */
export function comRotuloDaClasse(
  sql: string,
  colunas: string[],
  linhas: Array<Record<string, unknown>>,
): { colunas: string[]; linhas: Array<Record<string, unknown>> } {
  if (!colunas.includes("classe") || colunas.some((c) => /rotulo/i.test(c)))
    return { colunas, linhas };
  rotulosDasClasses ??= new Map(
    (
      db.prepare("SELECT indice, ordem, rotulo FROM classes").all() as Array<{
        indice: string;
        ordem: number;
        rotulo: string;
      }>
    ).map((c) => [`${c.indice}|${c.ordem}`, c.rotulo]),
  );
  const ids = new Set(
    [...rotulosDasClasses.keys()].map((k) => k.slice(0, k.lastIndexOf("|"))),
  );
  const colunaDoIndice = colunas.find((c) =>
    linhas.every((l) => ids.has(String(l[c]))),
  );
  const noSql = [...new Set(sql.match(/'[^']+'/g) ?? [])]
    .map((t) => t.slice(1, -1))
    .filter((t) => ids.has(t));
  const indiceDe = colunaDoIndice
    ? (l: Record<string, unknown>) => String(l[colunaDoIndice])
    : noSql.length === 1
      ? () => noSql[0]
      : undefined;
  if (!indiceDe) return { colunas, linhas };
  const i = colunas.indexOf("classe");
  return {
    colunas: [
      ...colunas.slice(0, i + 1),
      "rotulo_classe",
      ...colunas.slice(i + 1),
    ],
    linhas: linhas.map((l) => ({
      ...l,
      rotulo_classe:
        rotulosDasClasses!.get(`${indiceDe(l)}|${String(l.classe)}`) ?? "",
    })),
  };
}

const consultarSql: Ferramenta = {
  nome: "consultar_sql",
  titulo: "Consultar o tabelão com SQL",
  descricao: `Roda uma consulta SELECT/WITH (SQLite) no tabelão do SEDES e devolve até ${LIMITE_LINHAS} linhas. Gráfico: quando a consulta for a de uma série histórica (3 períodos ou mais) ou de um ranking (4 itens ou mais), passe também grafico; a página desenha o gráfico com o resultado. Com grafico, a consulta devolve só as colunas rotulo (período ou nome) e valor (número), na ordem do gráfico (série do mais antigo ao mais recente, ranking do maior ao menor), até ${LIMITE_GRAFICO} linhas. Tempo máximo ${PRAZO_SQL_MS / 1000} s. Erros voltam como texto: corrija a consulta e tente de novo.\n\n${ESQUEMA}`,
  entrada: {
    sql: z.string().min(6).describe("Uma consulta SELECT ou WITH"),
    grafico: z
      .object({
        tipo: z.enum(["serie", "ranking"]),
        titulo: z
          .string()
          .max(140)
          .describe(
            "Curto: o que é o valor, o território e o período. Em índices com classes, diga quais classes somou.",
          ),
        unidade: z
          .string()
          .max(30)
          .optional()
          .describe("Ex.: '% da área', '% das famílias do CadÚnico', 'R$'"),
      })
      .optional()
      .describe(
        "Só para séries históricas e rankings: a página desenha o gráfico",
      ),
    priorizacao: z
      .string()
      .max(20)
      .optional()
      .describe(
        `Id de uma análise de priorizar_municipios desta conversa (ex.: "pk3x9"): a consulta ganha a tabela ${COLUNAS_DA_TABELA}, para cruzar os níveis de prioridade com índices do tabelão`,
      ),
  },
  async executar({
    sql,
    grafico,
    priorizacao,
  }: {
    sql: string;
    grafico?: Grafico;
    priorizacao?: string;
  }) {
    const invalido = validarSql(sql);
    if (invalido) return `Erro: ${invalido}`;
    let final = sql;
    if (priorizacao) {
      const p = comPriorizacao(sql, priorizacao);
      if ("erro" in p) return `Erro: ${p.erro}`;
      final = p.sql;
    }
    const r = await executarSql(final);
    if (!r.ok)
      return /no such table: priorizacao/i.test(r.erro)
        ? "Erro: a tabela priorizacao só existe com o parâmetro priorizacao de consultar_sql (o id que priorizar_municipios devolve)."
        : `Erro: ${r.erro}`;
    if (grafico && r.linhas.length) {
      if (!r.colunas.includes("rotulo") || !r.colunas.includes("valor"))
        return `Erro: com grafico, a consulta tem de devolver as colunas rotulo e valor (use AS); devolveu ${r.colunas.join(", ")}.`;
      if (r.linhas.length > LIMITE_GRAFICO)
        return `Erro: ${r.linhas.length} linhas; o gráfico aceita até ${LIMITE_GRAFICO}. Filtre os períodos ou use LIMIT.`;
      if (r.linhas.some((l) => typeof l.valor !== "number"))
        return "Erro: com grafico, a coluna valor tem de ser numérica em todas as linhas.";
    }
    if (!r.linhas.length)
      return `Nenhuma linha. (Linha ausente = sem dado para aquele filtro.)${RODAPE}`;
    const aviso = r.truncado
      ? `\n(Mostrando só as primeiras ${LIMITE_LINHAS} linhas; refine a consulta.)`
      : "";
    if (grafico)
      return `${tabela(["rotulo", "valor"], r.linhas)}${aviso}${RODAPE}`;
    const t = comRotuloDaClasse(sql, r.colunas, r.linhas);
    return `${tabela(t.colunas, t.linhas)}${aviso}${RODAPE}`;
  },
};

const linkNoSedes: Ferramenta = {
  nome: "link_no_sedes",
  titulo: "Link para conferir no site",
  descricao:
    'Monta o link da plataforma SEDES que mostra o dado da resposta. Com território, abre o relatório daquele território com os índices pedidos (valor, mapa e série); sem território, abre o índice no mapa do Brasil. Chame sempre que a resposta trouxer valores de índices, de preferência junto com a consulta. Não escreva o link no texto: a página do chat mostra um botão "Ver no SEDES".',
  entrada: {
    indices: z
      .array(z.string())
      .min(1)
      .max(5)
      .describe("Ids dos índices usados na resposta, como em listar_indices"),
    territorio: z
      .string()
      .optional()
      .describe(
        "Código do território da resposta (IBGE, UF minúscula, 'br' ou recorte). Num ranking dentro de um estado ou recorte, passe o estado ou recorte. Omita só quando a resposta for sobre o Brasil todo.",
      ),
  },
  async executar({
    indices,
    territorio,
  }: {
    indices: string[];
    territorio?: string;
  }) {
    const existe = db.prepare("SELECT 1 FROM indices WHERE id = ?");
    const faltam = indices.filter((id) => !existe.get(id));
    if (faltam.length)
      return `Erro: índice(s) não existem: ${faltam.join(", ")}. Veja os ids em listar_indices.`;
    if (
      territorio &&
      !db.prepare("SELECT 1 FROM territorios WHERE codigo = ?").get(territorio)
    )
      return `Erro: território "${territorio}" não existe. Use buscar_territorio.`;
    const params = territorio
      ? new URLSearchParams({
          section: "communication",
          locationKey: territorio,
          period: String(new Date().getFullYear()),
          layers: indices.join(","),
        })
      : new URLSearchParams({ section: "monitoring", layer: indices[0] });
    return `${SITE_URL}/pt/platform?${params}\n(A página do chat mostra este link como botão; não o repita no texto. O relatório do site mostra os períodos mais recentes de cada índice.)`;
  },
};

/** Os textos do site (site.md) e o complemento, sem os comentários do topo. */
export function textosDoSite() {
  return ["site.md", "complemento.md"]
    .map((f) => path.join(CONHECIMENTO, f))
    .filter((f) => existsSync(f))
    .map((f) => readFileSync(f, "utf8").replace(/^<!--[\s\S]*?-->\n*/, ""))
    .join("\n\n---\n\n");
}

const sobreOSedes: Ferramenta = {
  nome: "sobre_o_sedes",
  titulo: "O que é o SEDES: textos do site e glossário",
  descricao:
    "Devolve os textos do site do SEDES (página inicial, Sobre e Glossário) e um complemento com termos que aparecem nos dados (decêndio, CadÚnico, recortes, classes, previsões). Use para perguntas sobre o que é o SEDES, quem faz, para que serve, como usar a plataforma, e sobre conceitos e termos (desertificação, seca, aridez, ASD, Semiárido...). Não traz valores de índices.",
  entrada: {},
  async executar() {
    return (
      textosDoSite() ||
      "Os textos do site ainda não foram baixados (npm run guia)."
    );
  },
};

const relatorioTerritorio: Ferramenta = {
  nome: "relatorio_territorio",
  titulo: "Relatório atual do site para um território",
  descricao: `Chama o relatório da plataforma SEDES, que lê as mesmas tabelas do tabelão, mas na versão publicada agora. É lento (1 a 15 s por chamada) e pode usar a fila do Earth Engine: use só quando o usuário pedir o que o site mostra agora, ou quando o tabelão não tiver um período que deveria existir (publicado depois de o tabelão ser gerado). Devolve um resumo por índice: período efetivo e classes com área. Com o parâmetro indice, mostra também os últimos 12 períodos daquele índice.`,
  entrada: {
    chave: z
      .string()
      .describe(
        "Código do território: IBGE de 7 dígitos, UF minúscula ('pb'), 'br', ou recorte como '3_bioma-caatinga', '2_regiao-nordeste', '5_semiarido-semiarido-total'",
      ),
    periodo: z
      .string()
      .regex(/^\d{4}(-\d{2})?$/)
      .describe(
        "AAAA ou AAAA-MM. Se o índice não tiver esse período, o relatório usa o mais próximo e avisa.",
      ),
    indice: z
      .string()
      .optional()
      .describe(
        "Opcional: parte do id ou do título de um índice (ex.: 'seca-ana', 'pib', 'cdi') para ver só ele, com a série recente",
      ),
  },
  async executar(
    {
      chave,
      periodo,
      indice,
    }: { chave: string; periodo: string; indice?: string },
    ctx: Contexto,
  ) {
    const url = `${BASE_URL}/api/municipal-report/${encodeURIComponent(chave)}?period=${periodo}`;
    try {
      // Com a plataforma fechada, o relatório pede login: vai o mesmo cookie
      // de sessão de quem perguntou ao chat.
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(PRAZO_RELATORIO_MS),
        headers: ctx.cookieSessao ? { cookie: ctx.cookieSessao } : {},
      });
      if (resp.status === 404)
        return `O site não reconhece o território "${chave}" (404). Use buscar_territorio para achar o código.`;
      if (resp.status === 400)
        return `Chave ou período em formato inválido (400): chave="${chave}", periodo="${periodo}".`;
      if (resp.status === 401 || resp.status === 403)
        return ctx.cookieSessao
          ? `O site recusou a sessão de quem perguntou (${resp.status}). Responda com o tabelão e diga que o dado atual não pôde ser obtido.`
          : `O site pediu login (${resp.status}). O site local precisa rodar com PLATFORM_ACCESS_GUARD_ENABLED=false.`;
      if (!resp.ok)
        return `O relatório falhou com HTTP ${resp.status}. Responda com o tabelão e diga que o dado atual não pôde ser obtido.`;
      return resumirRelatorio(await resp.json(), indice);
    } catch (error) {
      return `Não consegui falar com o site: ${(error as Error).message}. Responda com o tabelão e diga que o dado atual não pôde ser obtido.`;
    }
  },
};

/** Na ordem em que o modelo as vê: não mude à toa, a ordem entra no cache. */
export const FERRAMENTAS: Ferramenta[] = [
  listarIndices,
  detalharIndice,
  buscarTerritorio,
  consultarSql,
  linkNoSedes,
  sobreOSedes,
  relatorioTerritorio,
  priorizarMunicipios,
];
