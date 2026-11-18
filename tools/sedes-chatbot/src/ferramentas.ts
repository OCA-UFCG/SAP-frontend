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

async function executarSql(
  sql: string,
  limite = LIMITE_LINHAS,
): Promise<RespostaSql> {
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
      filho.send({ id, sql, limite });
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
      // O site põe a instituição de origem no nome ("Monitor de secas | ANA").
      // Sem esta linha o modelo dizia que o catálogo não tem a fonte e ia
      // procurar na lista de instituições do site (pergunta MT01).
      String(i.nome).includes(" | ")
        ? `Fonte (instituição, pelo nome no catálogo): ${String(i.nome).split(" | ").slice(1).join(" | ")}.`
        : "Fonte (instituição): o catálogo não diz; não deduza de outro lugar.",
      `Categoria: ${i.categoria}. Escala: ${i.escala_temporal}. Períodos: ${i.primeiro_periodo} a ${i.ultimo_periodo} (${i.qtd_periodos}). Atualizado em: ${i.atualizado_em ? dataBr(String(i.atualizado_em)) : "?"}.`,
      `Valor: ${i.significado_valor}`,
      `Recortes: ${i.agregacao}`,
      `Classes: ${cls}`,
      ...(OBSERVACOES[id] ? [`Observação: ${OBSERVACOES[id]}`] : []),
    ].join("\n");
  },
};

const UFS = new Set(
  "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(
    " ",
  ),
);

/** Só letras e números: "Olho d'Água" e "olho dagua" ficam iguais. */
const soLetras = (texto: string) => semAcento(texto).replace(/ /g, "");

/** "Campina Grande - PB", "Petrolina/PE", "Sousa (PB)", "Patos PB" → nome e UF. */
export function separarUf(nome: string): { nome: string; uf?: string } {
  const m = /^(.{2,}?)[\s,\-–/(]+([A-Za-z]{2})\)?\s*$/.exec(nome.trim());
  return m && UFS.has(m[2].toUpperCase())
    ? { nome: m[1].trim(), uf: m[2].toUpperCase() }
    : { nome: nome.trim() };
}

/** Quantas letras é preciso trocar, pôr ou tirar para a virar b (Levenshtein). */
export function distancia(a: string, b: string) {
  let linha = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const nova = [i];
    for (let j = 1; j <= b.length; j++)
      nova[j] = Math.min(
        linha[j] + 1,
        nova[j - 1] + 1,
        linha[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    linha = nova;
  }
  return linha[b.length];
}

type Territorio = {
  codigo: string;
  nome: string;
  nome_sem_acento: string;
  tipo: string;
  uf: string | null;
  regiao: string | null;
  bioma: string | null;
  semiarido: number | null;
};

let territoriosEmMemoria: Array<Territorio & { chaves: string[] }> | undefined;
/** Todos os territórios, com as formas do nome que valem como "nome exato". */
function todosOsTerritorios() {
  territoriosEmMemoria ??= (
    db
      .prepare(
        "SELECT codigo, nome, nome_sem_acento, tipo, uf, regiao, bioma, semiarido FROM territorios",
      )
      .all() as Territorio[]
  ).map((t) => ({
    ...t,
    // 'Área Operacional "Lagoa dos Patos"' também atende por "Lagoa dos Patos".
    chaves: [
      soLetras(t.nome_sem_acento),
      soLetras(t.nome_sem_acento.replace(/^area operacional /, "")),
    ],
  }));
  return territoriosEmMemoria;
}

const COLUNAS_DO_TERRITORIO = [
  "codigo",
  "nome",
  "tipo",
  "uf",
  "regiao",
  "bioma",
  "semiarido",
];

/**
 * A busca de buscar_territorio. Tenta, nesta ordem: o nome exato (sem contar
 * acento, maiúscula, hífen ou apóstrofo), o nome com a UF no fim ("Patos -
 * PB"), um pedaço do nome e, por último, nomes com a grafia parecida (erro de
 * digitação). Sem isto, "Cajazieras" ou "Campina Grande - PB" voltavam como
 * "nenhum território" e o modelo dizia que o SEDES não tinha o município.
 */
export function buscarTerritorios(nome: string, uf?: string): string {
  const todos = todosOsTerritorios();
  const naUf = (t: Territorio, sigla?: string) =>
    !sigla || t.uf === sigla.toUpperCase();
  const exatos = (texto: string, sigla?: string) => {
    const chave = soLetras(texto);
    return todos.filter((t) => t.chaves.includes(chave) && naUf(t, sigla));
  };
  const ordenar = (ts: Territorio[]) =>
    [...ts].sort(
      (a, b) =>
        a.tipo.localeCompare(b.tipo) || (a.uf ?? "").localeCompare(b.uf ?? ""),
    );

  let linhas = ordenar(exatos(nome, uf));
  let modo = "nome exato";
  if (!linhas.length) {
    const partes = separarUf(nome);
    if (partes.uf && (!uf || uf.toUpperCase() === partes.uf))
      linhas = ordenar(exatos(partes.nome, partes.uf));
  }
  if (!linhas.length) {
    const alvo = semAcento(nome);
    linhas = todos
      .filter((t) => t.nome_sem_acento.includes(alvo) && naUf(t, uf))
      .sort(
        (a, b) =>
          a.nome.length - b.nome.length ||
          (a.uf ?? "").localeCompare(b.uf ?? ""),
      )
      .slice(0, 30);
    modo = "nome parecido";
  }
  if (!linhas.length) {
    // Erro de digitação: 1 letra de diferença em nomes curtos, até 3 nos longos.
    const alvo = soLetras(separarUf(nome).nome);
    const ufDoNome = uf ?? separarUf(nome).uf;
    const limite =
      alvo.length >= 16 ? 3 : alvo.length >= 10 ? 2 : alvo.length >= 5 ? 1 : 0;
    const proximos = todos
      .filter((t) => naUf(t, ufDoNome))
      .map((t) => ({ t, d: distancia(alvo, t.chaves[0]) }))
      .filter((x) => x.d <= limite)
      .sort((a, b) => a.d - b.d || (a.t.uf ?? "").localeCompare(b.t.uf ?? ""))
      .slice(0, 8);
    if (proximos.length)
      return `Nenhum território do SEDES se chama exatamente "${nome}". Os de grafia mais parecida:\n${tabela(
        COLUNAS_DO_TERRITORIO,
        proximos.map((x) => x.t),
      )}\nSe a diferença é só um erro de digitação (letra trocada, faltando ou sobrando), use esse território e escreva o nome certo na resposta; com dúvida entre mais de um, pergunte. Se a pessoa falou de outro lugar (um bairro, um distrito, outro país), diga que o SEDES não tem esse lugar e não use os dados de um território só parecido.`;
    return `Nenhum território do SEDES tem nome parecido com "${nome}"${uf ? ` na UF ${uf}` : ""}. O SEDES tem municípios, estados, regiões, biomas, o Semiárido e as ASD: não tem bairros, distritos, mesorregiões, regiões metropolitanas, bacias nem outros países.`;
  }
  const municipios = linhas.filter((l) => l.tipo === "municipio").length;
  const tipos = new Set(linhas.map((l) => l.tipo));
  const aviso =
    modo === "nome exato" && municipios > 1
      ? `\nATENÇÃO: ${municipios} municípios com esse nome. Pergunte ao usuário a UF antes de responder.`
      : modo === "nome exato" && tipos.size > 1
        ? `\nATENÇÃO: territórios de tipos diferentes com esse nome (${[...tipos].join(" e ")}). Diga na resposta qual deles você usou e cite o outro, ou pergunte qual a pessoa quer.`
        : "";
  return `Busca por ${modo}:\n${tabela(COLUNAS_DO_TERRITORIO, linhas)}${aviso}`;
}

const buscarTerritorio: Ferramenta = {
  nome: "buscar_territorio",
  titulo: "Buscar território pelo nome",
  descricao:
    "Procura municípios, estados, regiões, biomas e outros recortes pelo nome, sem diferenciar acento ou maiúscula, e acha nomes com erro de digitação. Devolve TODOS os homônimos com UF; se houver mais de um município com o nome, pergunte ao usuário qual é (ou liste as opções). O campo codigo é o que se usa na coluna valores.territorio e na ferramenta relatorio_territorio.",
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
    return buscarTerritorios(nome, uf);
  },
};

const ESQUEMA = `Banco SQLite só leitura (o tabelão do SEDES). Tabelas:
- indices(id, nome, descricao, categoria, escala_temporal, primeiro_periodo, ultimo_periodo, qtd_periodos, tipo_valor, significado_valor, unidade, fonte, agregacao, previsao, atualizado_em, observacao)
- classes(indice, ordem, rotulo)  -- ordem começa em 1
- periodos(indice, periodo, rotulo)  -- rotulo legível (ex.: trimestre da previsão)
- territorios(codigo, nome, nome_sem_acento, tipo, uf, regiao, bioma, semiarido, asd_entorno, area_km2)
    tipo: 'municipio' | 'estado' | 'pais' | 'regiao' | 'bioma' | 'semiarido' | 'asd' | 'lagoa'
    codigo: IBGE de 7 dígitos (município), sigla minúscula ('pb') para estado, 'br', '2_regiao-nordeste', '3_bioma-caatinga', '5_semiarido-semiarido-total', '4_asd-asd-entorno', '4_asd-apenas-asd'
    uf: sigla MAIÚSCULA ('PB'). bioma: bioma predominante do município. semiarido / asd_entorno: 1 ou 0 (só municípios). Todo município do Semiárido está em ASD + Entorno; não há lista de municípios do recorte "Apenas ASD" (para ele, use o valor próprio do recorte, '4_asd-apenas-asd')
    area_km2: área do território. Área de uma classe em km² = valor/100 * area_km2 (em índices "% da área")
- valores(indice, periodo, ano, mes, territorio, classe, valor)  -- formato longo: uma linha por classe
    periodo: 'AAAA' (anual), 'AAAA-MM' (mensal) ou 'AAAA-MM-DD' (decendial: dias 01, 11 e 21; só o CDI).
    valor já está na unidade final (% da área, % de famílias, contagem, reais...; veja listar_indices). Valores com casas a mais: arredonde ao responder.
    Índices de valor único têm só classe = 1.
    Ao falar de uma classe, use o rótulo (rotulo_classe em valores_com_nomes), nunca o número: no Índice de Degradação da Terra a classe 1 é o "Nível 5" e a classe 5 é o "Nível 1".
    Linha ausente = sem dado para aquele território e período.
- valores_com_nomes: visão de valores com nome_territorio, tipo_territorio, uf e rotulo_classe.
- medias(indice, periodo, territorio, media, mediana, minimo, maximo)  -- o valor médio do índice no território, na unidade das classes (mm, °C, índice de aridez, kg C/m², g/kg). Só para: previsões de acumulado, anomalia e temperatura média (não as de probabilidade), os dois índices de aridez, PPB e carbono do solo. É com ela que se responde "quantos mm", "quantos graus", "qual o valor médio".
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
   ON c.mes=m.periodo ORDER BY m.periodo;
6) Onde a seca piorou entre dois meses: compare a seca moderada ou pior (classe >= 3) E a grave ou pior (classe >= 4); usar só a grave esconde quem passou de fraca para moderada.
   SELECT t.nome AS rotulo, SUM(CASE WHEN v.periodo='2026-09' AND v.classe>=3 THEN v.valor ELSE 0 END) - SUM(CASE WHEN v.periodo='2026-06' AND v.classe>=3 THEN v.valor ELSE 0 END) AS valor,
   SUM(CASE WHEN v.periodo='2026-09' AND v.classe>=4 THEN v.valor ELSE 0 END) - SUM(CASE WHEN v.periodo='2026-06' AND v.classe>=4 THEN v.valor ELSE 0 END) AS variacao_grave_ou_pior
   FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='monitor-de-seca-ana' AND v.periodo IN ('2026-06','2026-09') AND t.tipo='municipio' AND t.uf='CE'
   GROUP BY t.codigo ORDER BY valor DESC LIMIT 10;
7) Milímetros previstos (média do território, das duas fontes) e km² em seca grave ou pior:
   SELECT indice, media, minimo, maximo FROM medias WHERE territorio='2611101' AND periodo='2026-12' AND indice IN ('previsao-precipitacao-mensal-acumulado-cptec-2','previsao-precipitacao-mensal-acumulado-inmet');
   SELECT SUM(v.valor) AS pct_da_area, ROUND(SUM(v.valor)/100*t.area_km2) AS km2, t.area_km2 FROM valores v JOIN territorios t ON t.codigo=v.territorio
   WHERE v.indice='monitor-de-seca-ana' AND v.periodo='2026-09' AND v.territorio='pb' AND v.classe>=4;
9) Posição de um município no grupo ("está entre os mais pobres?"): conte os maiores E os menores na consulta; não subtraia de cabeça.
   SELECT SUM(v.valor > x.valor) AS com_valor_maior, SUM(v.valor < x.valor) AS com_valor_menor, COUNT(*) AS total, x.valor FROM valores v JOIN territorios t ON t.codigo=v.territorio,
   (SELECT valor FROM valores WHERE indice='percentual-de-pobreza-total-cadunico' AND periodo='2025' AND territorio='2504009') x
   WHERE v.indice='percentual-de-pobreza-total-cadunico' AND v.periodo='2025' AND t.tipo='municipio' AND t.uf='PB';
10) Média no tempo (no ano, na década) da área em seca: some as classes em cada período e só depois tire a média. AVG direto sobre as linhas de classe dá a média entre as classes, que é outro número.
   SELECT ano, ROUND(AVG(s),1) AS valor FROM (SELECT ano, periodo, SUM(valor) AS s FROM valores WHERE indice='indice-combinado-de-seca-cdi' AND territorio='ce' AND classe BETWEEN 2 AND 4 GROUP BY periodo) GROUP BY ano ORDER BY ano;
8) Mapa (grafico = {tipo:'mapa', titulo:'Seca grave ou pior na Paraíba, setembro de 2026', unidade:'% da área'}): uma linha por município, com as colunas codigo e valor; sem LIMIT (o mapa mostra todos).
   SELECT t.codigo, SUM(CASE WHEN v.classe>=4 THEN v.valor ELSE 0 END) AS valor FROM valores v JOIN territorios t ON t.codigo=v.territorio
   WHERE v.indice='monitor-de-seca-ana' AND v.periodo='2026-09' AND t.tipo='municipio' AND t.uf='PB' GROUP BY t.codigo;`;

type Grafico = {
  tipo: "serie" | "ranking" | "mapa";
  titulo: string;
  unidade?: string;
};

const LIMITE_MAPA = 6000;

const num1 = (v: number) =>
  String(Math.round(v * 10) / 10).replace(".", ",");

/**
 * O resumo de uma série ou de um ranking, calculado aqui. O modelo copia estes
 * números em vez de achar de olho o maior, o menor e a tendência numa lista:
 * era onde o Haiku errava ("o único aumento da série", "sem tendência").
 */
export function resumoCalculado(
  tipo: "serie" | "ranking",
  pontos: Array<{ rotulo: string; valor: number }>,
  unidade?: string,
): string {
  if (pontos.length < 3) return "";
  const vs = pontos.map((p) => p.valor);
  const max = Math.max(...vs);
  const min = Math.min(...vs);
  const media = vs.reduce((a, b) => a + b, 0) / vs.length;
  const onde = (v: number) => {
    const r = pontos.filter((p) => p.valor === v).map((p) => p.rotulo);
    return r.length > 3
      ? `${r.slice(0, 3).join(", ")} e mais ${r.length - 3}`
      : r.join(", ");
  };
  const linhas = [
    `Resumo calculado (copie daqui; não refaça de cabeça):`,
    `- ${tipo === "serie" ? `${pontos.length} períodos, de ${pontos[0].rotulo} a ${pontos.at(-1)!.rotulo}` : `${pontos.length} itens`}; maior ${num1(max)} (${onde(max)}); menor ${num1(min)} (${onde(min)}); média simples dos ${pontos.length} ${num1(media)}.`,
  ];
  if (tipo === "ranking") {
    const ordenados = [...vs].sort((a, b) => a - b);
    const meio = ordenados.length >> 1;
    const mediana =
      ordenados.length % 2
        ? ordenados[meio]
        : (ordenados[meio - 1] + ordenados[meio]) / 2;
    const zeros = vs.filter((v) => v === 0).length;
    linhas.push(
      `- mediana ${num1(mediana)}${zeros ? `; ${zeros} com valor 0` : ""}.`,
    );
    return linhas.join("\n");
  }
  const primeiro = pontos[0];
  const ultimo = pontos.at(-1)!;
  const penultimo = pontos.at(-2)!;
  const d = ultimo.valor - primeiro.valor;
  linhas.push(
    `- Do primeiro ao último: ${num1(primeiro.valor)} (${primeiro.rotulo}) → ${num1(ultimo.valor)} (${ultimo.rotulo}), ${d === 0 ? "sem mudança" : `${d > 0 ? "alta" : "queda"} de ${num1(Math.abs(d))}`}. Do penúltimo (${penultimo.rotulo}, ${num1(penultimo.valor)}) ao último: ${ultimo.valor === penultimo.valor ? "igual" : `${ultimo.valor > penultimo.valor ? "alta" : "queda"} de ${num1(Math.abs(ultimo.valor - penultimo.valor))}`}.`,
  );
  // "Quanto cresceu?" pede a variação em %. Só quando o valor não é ele mesmo
  // uma porcentagem: em "% da área", "caiu 50%" se confunde com 50 pontos.
  if (unidade && !unidade.includes("%") && primeiro.valor > 0 && ultimo.valor > 0 && d !== 0) {
    const rel = (ultimo.valor / primeiro.valor - 1) * 100;
    linhas.push(
      `- Variação do primeiro ao último, em relação ao primeiro: ${rel > 0 ? "+" : "−"}${num1(Math.abs(rel))}% (o último é ${num1(ultimo.valor / primeiro.valor)} vezes o primeiro).`,
    );
  }
  const altas: string[] = [];
  const quedas: string[] = [];
  for (let i = 1; i < vs.length; i++) {
    if (vs[i] > vs[i - 1]) altas.push(pontos[i].rotulo);
    else if (vs[i] < vs[i - 1]) quedas.push(pontos[i].rotulo);
  }
  // Com poucas altas (ou quedas), dizer quais: o modelo contava de cabeça e
  // esquecia as pequenas ("só subiu em 2022", quando subiu também em 2020 e 2024).
  const quais = (ps: string[]) =>
    ps.length && ps.length <= 6 ? ` (em ${ps.join(", ")})` : "";
  linhas.push(
    `- De um período para o seguinte: ${altas.length} altas${quais(altas)}, ${quedas.length} quedas${quais(quedas)}, ${vs.length - 1 - altas.length - quedas.length} iguais.`,
  );
  // Sequências de períodos seguidos acima de zero (ex.: meses em seca).
  if (min === 0 && max > 0) {
    let atual = 0;
    for (let i = vs.length - 1; i >= 0 && vs[i] > 0; i--) atual += 1;
    let maior = 0;
    let fimDaMaior = -1;
    let corrida = 0;
    vs.forEach((v, i) => {
      corrida = v > 0 ? corrida + 1 : 0;
      if (corrida > maior) {
        maior = corrida;
        fimDaMaior = i;
      }
    });
    linhas.push(
      `- Períodos seguidos com valor acima de 0: ${atual ? `${atual} até o último (desde ${pontos[vs.length - atual].rotulo})` : `nenhum agora (o último, ${ultimo.rotulo}, é 0)`}; a maior sequência foi de ${maior} (${pontos[fimDaMaior - maior + 1].rotulo} a ${pontos[fimDaMaior].rotulo}).`,
    );
  }
  return linhas.join("\n");
}

let idsConhecidos: Set<string> | undefined;

/**
 * Id de índice escrito errado na consulta não dá erro no SQL: só não traz
 * linhas, e o modelo concluía que "o SEDES não tem esse dado". A nota diz que
 * o id não existe e quais são os parecidos.
 */
export function notasDeIdsDesconhecidos(sql: string): string[] {
  idsConhecidos ??= new Set(
    (
      db
        .prepare("SELECT id FROM indices UNION SELECT codigo FROM territorios")
        .all() as Array<{ id: string }>
    ).map((i) => i.id),
  );
  const indices = (
    db.prepare("SELECT id FROM indices").all() as Array<{ id: string }>
  ).map((i) => i.id);
  const literais = [...new Set(sql.match(/'[^']+'/g) ?? [])].map((t) =>
    t.slice(1, -1),
  );
  const notas: string[] = [];
  for (const literal of literais) {
    if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/u.test(literal)) continue;
    if (idsConhecidos.has(literal)) continue;
    const partes = new Set(literal.split("-"));
    const parecidos = indices
      .map((id) => {
        const ps = id.split("-");
        const comuns = ps.filter((x) => partes.has(x)).length;
        return { id, nota: comuns / (ps.length + partes.size - comuns) };
      })
      .filter((x) => x.nota >= 0.4)
      .sort((a, b) => b.nota - a.nota)
      .slice(0, 3)
      .map((x) => `'${x.id}'`);
    if (!parecidos.length) continue;
    notas.push(
      `Atenção: não existe índice com o id '${literal}', por isso ele não trouxe linhas. Ids parecidos no catálogo: ${parecidos.join(", ")}. Refaça a consulta com o id certo; não diga que o SEDES não tem o dado.`,
    );
  }
  return notas;
}

const LADO = { abaixo: "abaixo do normal", acima: "acima do normal" } as const;

/**
 * Nas previsões de anomalia e de probabilidade, soma a área de cada lado
 * (abaixo ou acima do normal) por índice e período, e avisa quando duas fontes
 * apontam para lados diferentes. O modelo tinha os números na mão e escrevia
 * que "as duas fontes concordam".
 */
export function resumoDasPrevisoes(
  colunas: string[],
  linhas: Array<Record<string, unknown>>,
): string {
  const colIndice = colunas.find((c) =>
    linhas.every((l) => /anomalia|probabilidade/u.test(String(l[c]))),
  );
  const colRotulo = colunas.find(
    (c) =>
      c !== colIndice &&
      linhas.every((l) => /abaixo|cima/iu.test(String(l[c]))),
  );
  const colValor = colunas.includes("valor")
    ? "valor"
    : colunas.find((c) => c !== "classe" && linhas.every((l) => ehNumero(l[c])));
  if (!colIndice || !colRotulo || !colValor) return "";
  if (!linhas.every((l) => ehNumero(l[colValor]))) return "";
  const outras = colunas.filter(
    (c) => ![colIndice, colRotulo, colValor, "classe"].includes(c),
  );
  type Grupo = {
    indice: string;
    resto: string;
    abaixo: number;
    acima: number;
    leve: number;
    maior: { rotulo: string; valor: number };
  };
  const grupos = new Map<string, Grupo>();
  for (const l of linhas) {
    const indice = String(l[colIndice]);
    const resto = outras.map((c) => String(l[c])).join(", ");
    const g =
      grupos.get(`${indice}|${resto}`) ??
      ({ indice, resto, abaixo: 0, acima: 0, leve: 0, maior: { rotulo: "", valor: -1 } } as Grupo);
    const rotulo = String(l[colRotulo]);
    const valor = l[colValor] as number;
    g[/abaixo/iu.test(rotulo) ? "abaixo" : "acima"] += valor;
    if (/^levemente/iu.test(rotulo)) g.leve += valor;
    if (valor > g.maior.valor) g.maior = { rotulo, valor };
    grupos.set(`${indice}|${resto}`, g);
  }
  // Área somada acima de 100: a consulta juntou territórios ou períodos.
  const gs = [...grupos.values()];
  if (gs.length > 16 || gs.some((g) => g.abaixo + g.acima > 100.5)) return "";
  const lado = (g: Grupo) => (g.abaixo > g.acima ? "abaixo" : "acima");
  const texto = gs.map(
    (g) =>
      `- ${g.indice}${g.resto ? ` (${g.resto})` : ""}: ${num1(g.abaixo)}% da área ${LADO.abaixo}, ${num1(g.acima)}% ${LADO.acima}; a maior classe é "${g.maior.rotulo}" (${num1(g.maior.valor)}%).${g.leve >= 50 ? ` Desvio pequeno: ${num1(g.leve)}% da área está em classes "levemente"; diga isso.` : ""}`,
  );
  const tipo = (id: string) =>
    `${/probabilidade/u.test(id) ? "probabilidade" : "anomalia"} de ${/temperatura/u.test(id) ? "temperatura" : "chuva"}${/trimestral/u.test(id) ? " trimestral" : ""}`;
  const discordam = new Set<string>();
  for (const a of gs)
    for (const b of gs)
      if (
        a.indice < b.indice &&
        a.resto === b.resto &&
        tipo(a.indice) === tipo(b.indice) &&
        lado(a) !== lado(b)
      )
        discordam.add(
          `${tipo(a.indice)}${a.resto ? `, ${a.resto}` : ""}: ${a.indice} pende para ${LADO[lado(a)]} e ${b.indice} para ${LADO[lado(b)]}`,
        );
  return [
    "Resumo calculado das previsões (o lado de cada fonte; copie daqui):",
    ...texto,
    ...(discordam.size
      ? [
          `ATENÇÃO: as fontes discordam (${[...discordam].join("; ")}). A primeira frase da resposta diz que elas discordam; não escreva que concordam nem que "não há sinal" de um dos lados.`,
        ]
      : []),
  ].join("\n");
}

/**
 * Ressalvas que vão junto da saída quando a consulta toca num ponto em que o
 * modelo costuma escorregar. No prompt elas eram ignoradas pelo Haiku; na saída
 * da ferramenta, não.
 */
function notasDaConsulta(sql: string, truncadoPorLimit: boolean): string {
  const notas: string[] = [...notasDeIdsDesconhecidos(sql), ...notasDaForma(sql)];
  if (/previsao-anomalia-|anomalia-de-temperatura/u.test(sql) && !/probabilidade/u.test(sql))
    notas.push(
      'Nota: esta consulta trouxe só a anomalia. Se a pergunta é "acima ou abaixo do normal?", traga também a probabilidade (os índices com "probabilidade" no id, do mesmo período) antes de responder: os dois tipos podem apontar para lados diferentes, e a contagem de municípios muda.',
    );
  if (/probabilidade/u.test(sql))
    notas.push(
      'Nota: nas classes de probabilidade o sinal de menos só indica o lado. "-65% a -40% (abaixo da Normal)" se escreve "40% a 65% de chance de ficar abaixo do normal". Não existe chance negativa: não escreva "-40%" na resposta.',
    );
  if (/4_asd-/u.test(sql) || /\basd_entorno\b/u.test(sql))
    notas.push(
      'Nota: todo município do Semiárido está dentro do recorte ASD + Entorno. Não existe "Semiárido fora das ASD" nos dados: compare os recortes entre si e diga isso.',
    );
  if (/'prodes-inpe'/u.test(sql))
    notas.push(
      'Nota: no PRODES a classe "Desmatamento Acumulado" é tudo o que foi desmatado até o ano. O desmatamento de um ano é a diferença para o ano anterior com dado.',
    );
  if (truncadoPorLimit)
    notas.push(
      'Nota: a consulta tem LIMIT. O que não aparece aqui não é zero: antes de escrever "nenhum", "só" ou "todos", conte com outra consulta sem LIMIT.',
    );
  return notas.length ? `\n${notas.join("\n")}` : "";
}

/**
 * Colunas que o modelo inventa com frequência e que só têm um sentido possível.
 * Na rodada amp-2, 5 de 13 erros de consulta foram "codigo_territorio" em
 * valores_com_nomes (a coluna é territorio). Trocar aqui poupa uma ida ao
 * modelo; nenhuma tabela tem uma coluna com esse nome.
 */
export function corrigirColunasInventadas(sql: string): string {
  let novo = sql.replace(/\bcodigo_territorio\b/g, "territorio");
  // Consulta só na visão (sem territorios): "codigo" só pode ser territorio.
  if (/\bvalores_com_nomes\b/i.test(novo) && !/\bterritorios\b/i.test(novo))
    novo = novo.replace(/\b(\w+\.)?codigo\b/g, "$1territorio");
  // Consulta só na tabela indices: a coluna do id se chama id, não indice.
  const tabelas = [...novo.matchAll(/\b(?:from|join)\s+(\w+)/gi)].map((m) =>
    m[1].toLowerCase(),
  );
  if (tabelas.length && tabelas.every((t) => t === "indices"))
    novo = novo.replace(/\bindice\b/g, "id");
  return novo;
}

const COLUNAS_DAS_TABELAS: Record<string, string> = {
  indices:
    "id, nome, descricao, categoria, escala_temporal, primeiro_periodo, ultimo_periodo, qtd_periodos, tipo_valor, significado_valor, unidade, fonte, agregacao, previsao, atualizado_em, observacao",
  classes: "indice, ordem, rotulo",
  periodos: "indice, periodo, rotulo",
  territorios:
    "codigo, nome, nome_sem_acento, tipo, uf, regiao, bioma, semiarido, asd_entorno, area_km2",
  valores: "indice, periodo, ano, mes, territorio, classe, valor",
  valores_com_nomes:
    "indice, periodo, ano, mes, territorio, nome_territorio, tipo_territorio, uf, classe, rotulo_classe, valor",
  medias: "indice, periodo, territorio, media, mediana, minimo, maximo",
};

/**
 * O que acrescentar a um erro de SQL para a consulta seguinte sair certa. Na
 * rodada amp-1, 15 chamadas voltaram com erro, quase todas por nome de coluna
 * (indices.indice em vez de id, nome em valores_com_nomes) ou por juntar
 * valores com a visão valores_com_nomes, que estoura o prazo.
 */
export function dicaDoErro(sql: string, erro: string): string {
  if (/no such column/i.test(erro)) {
    const usadas = Object.keys(COLUNAS_DAS_TABELAS).filter((t) =>
      new RegExp(`\\b${t}\\b`, "i").test(sql),
    );
    return usadas.length
      ? ` Colunas que existem: ${usadas.map((t) => `${t}(${COLUNAS_DAS_TABELAS[t]})`).join("; ")}.`
      : "";
  }
  if (/passou de/.test(erro) && /\bvalores\b/i.test(sql) && /valores_com_nomes/i.test(sql))
    return " Não junte valores com valores_com_nomes: a visão já tem tudo (rotulo_classe, nome_territorio); use só ela, com indice, periodo e territorio no WHERE.";
  return "";
}

let estadosComMunicipioDeMesmoNome: Map<string, string> | undefined;
/** Sigla do estado → código do município de mesmo nome na mesma UF (sp, rj, go, ap). */
function mesmoNome() {
  estadosComMunicipioDeMesmoNome ??= new Map(
    (
      db
        .prepare(
          "SELECT e.codigo AS estado, m.codigo AS municipio FROM territorios e JOIN territorios m ON m.tipo='municipio' AND m.nome_sem_acento = e.nome_sem_acento AND m.uf = e.uf WHERE e.tipo='estado'",
        )
        .all() as Array<{ estado: string; municipio: string }>
    ).map((l) => [l.estado, l.municipio]),
  );
  return estadosComMunicipioDeMesmoNome;
}

/** Notas que dependem do que a consulta pede (testadas à parte). */
export function notasDaForma(sql: string): string[] {
  const notas: string[] = [];
  // AVG direto sobre as linhas de classe: a média sai entre as classes, não
  // entre os períodos (deu 21,9% onde o certo era 65,6%, na pergunta CA04).
  if (
    /\bAVG\s*\(/i.test(sql) &&
    !/\bSUM\s*\(/i.test(sql) &&
    /classe\s*(>=|<=|>|<|\bIN\b|\bBETWEEN\b)/i.test(sql) &&
    !/\bFROM\s+medias\b/i.test(sql)
  )
    notas.push(
      "ATENÇÃO: esta consulta tira AVG de linhas de várias classes. Isso dá a média ENTRE AS CLASSES, não a média no tempo da área somada, e o número sai menor que o certo. Refaça em dois passos (exemplo 10): some as classes em cada período numa subconsulta (SUM ... GROUP BY periodo) e tire o AVG do resultado. Não use os números desta saída.",
    );
  // São Paulo, Rio de Janeiro, Goiás e Amapá são estado e município.
  for (const [estado, municipio] of mesmoNome()) {
    const temEstado = new RegExp(`'${estado}'`, "i").test(sql);
    const temMunicipio = sql.includes(`'${municipio}'`);
    if (temEstado !== temMunicipio)
      notas.push(
        `Nota: existe um estado e um município com este nome. Esta consulta trouxe só o ${temEstado ? `ESTADO ('${estado}'); o município é '${municipio}'` : `MUNICÍPIO ('${municipio}'); o estado é '${estado}'`}. Se a pessoa não disse qual queria, diga na primeira frase que o dado é do ${temEstado ? "estado" : "município"} e ofereça o outro (ou traga os dois).`,
      );
  }
  return notas;
}

const ehNumero = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/**
 * Acha as colunas do gráfico quando a consulta não as chamou de rotulo e
 * valor. Antes isso voltava como erro e custava uma ida a mais ao modelo.
 */
function colunasDoGrafico(
  colunas: string[],
  linhas: Array<Record<string, unknown>>,
): { rotulo: string; valor: string } | null {
  const numerica = (c: string) => linhas.every((l) => ehNumero(l[c]));
  const valor = colunas.includes("valor")
    ? "valor"
    : colunas.find((c) => c !== colunas[0] && numerica(c));
  const rotulo = colunas.includes("rotulo")
    ? "rotulo"
    : colunas.find((c) => c !== valor);
  return valor && rotulo && numerica(valor) ? { rotulo, valor } : null;
}

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
  descricao: `Roda uma consulta SELECT/WITH (SQLite) no tabelão do SEDES e devolve até ${LIMITE_LINHAS} linhas. Gráfico: quando a consulta for a de uma série histórica (3 períodos ou mais) ou de um ranking (4 itens ou mais), passe também grafico; a página desenha o gráfico com o resultado. Com grafico serie ou ranking, a consulta devolve as colunas rotulo (período ou nome) e valor (número), na ordem do gráfico (série do mais antigo ao mais recente, ranking do maior ao menor), até ${LIMITE_GRAFICO} linhas; a saída traz um "Resumo calculado" (maior, menor, início e fim, sequências) para citar. Mapa: quando a pergunta for "onde" dentro de um estado, região, bioma ou recorte (ou pedir um mapa), passe grafico com tipo 'mapa' e uma consulta com as colunas codigo (IBGE do município) e valor, uma linha por município, sem LIMIT; a página pinta os municípios e a saída traz o resumo e os extremos. O link "Ver no SEDES" é montado sozinho a partir das consultas. Tempo máximo ${PRAZO_SQL_MS / 1000} s. Erros voltam como texto: corrija a consulta e tente de novo.\n\n${ESQUEMA}`,
  entrada: {
    sql: z.string().min(6).describe("Uma consulta SELECT ou WITH"),
    grafico: z
      .object({
        tipo: z.enum(["serie", "ranking", "mapa"]),
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
        "Para séries históricas, rankings e mapas de municípios: a página desenha",
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
    sql = corrigirColunasInventadas(sql);
    let final = sql;
    if (priorizacao) {
      const p = comPriorizacao(sql, priorizacao);
      if ("erro" in p) return `Erro: ${p.erro}`;
      final = p.sql;
    }
    const r = await executarSql(
      final,
      grafico?.tipo === "mapa" ? LIMITE_MAPA : LIMITE_LINHAS,
    );
    if (!r.ok)
      return /no such table: priorizacao/i.test(r.erro)
        ? "Erro: a tabela priorizacao só existe com o parâmetro priorizacao de consultar_sql (o id que priorizar_municipios devolve)."
        : `Erro: ${r.erro}${dicaDoErro(sql, r.erro)}`;
    if (!r.linhas.length)
      return `Nenhuma linha. (Linha ausente = sem dado para aquele filtro.)${notasDeIdsDesconhecidos(sql)
        .map((n) => `\n${n}`)
        .join("")}${RODAPE}`;
    const limit = /\blimit\s+(\d+)\s*;?\s*$/iu.exec(sql);
    const notas = notasDaConsulta(
      sql,
      Boolean(limit) && r.linhas.length >= Number(limit![1]),
    );
    if (grafico?.tipo === "mapa")
      return saidaDoMapa(r.colunas, r.linhas).replace(RODAPE, notas + RODAPE);
    const aviso =
      (r.truncado
        ? `\n(Mostrando só as primeiras ${LIMITE_LINHAS} linhas; refine a consulta.)`
        : "") + notas;
    if (grafico) {
      const c = colunasDoGrafico(r.colunas, r.linhas);
      if (!c)
        return `Erro: com grafico, a consulta tem de devolver uma coluna de rótulo e uma coluna numérica chamada valor (use AS); devolveu ${r.colunas.join(", ")}.`;
      // Série com várias linhas por período (uma por classe): o gráfico de
      // série quer uma linha por período. Em vez de erro (ou de um gráfico e
      // um resumo que misturam as classes), devolve a tabela e diz como pedir.
      const rotulos = new Set(r.linhas.map((l) => String(l[c.rotulo])));
      // Também quando há uma linha por período mas a classe muda de um para
      // outro (fraca, fraca, moderada: os três com 100%): o gráfico sairia
      // reto e o resumo diria "sem mudança".
      const classes = new Set(
        r.linhas.map((l) => String(l.rotulo_classe ?? l.classe ?? "")),
      );
      if (
        grafico.tipo === "serie" &&
        (rotulos.size < r.linhas.length || classes.size > 1)
      ) {
        const t = comRotuloDaClasse(sql, r.colunas, r.linhas);
        return `${tabela(t.colunas, t.linhas)}\nNota: saiu SEM gráfico. O gráfico de série precisa de uma linha por período com o mesmo significado, e esta consulta traz as classes separadas. Os dados acima valem para responder. Se quiser o gráfico, some as classes que interessam numa linha por período (ex.: SUM(CASE WHEN classe >= 3 THEN valor ELSE 0 END) AS valor ... GROUP BY periodo).${aviso}${RODAPE}`;
      }
      if (r.linhas.length > LIMITE_GRAFICO)
        return `Erro: ${r.linhas.length} linhas; o gráfico aceita até ${LIMITE_GRAFICO}. Filtre os períodos ou use LIMIT.`;
      const pontos = r.linhas.map((l) => ({
        rotulo: String(l[c.rotulo]),
        valor: l[c.valor] as number,
      }));
      const outras = r.colunas.filter((x) => x !== c.rotulo && x !== c.valor);
      const resumo = resumoCalculado(
        grafico.tipo as "serie" | "ranking",
        pontos,
        grafico.unidade,
      );
      // A página lê a tabela "rotulo | valor"; colunas a mais vão depois dela.
      return [
        tabela(["rotulo", "valor"], pontos),
        ...(resumo ? ["", resumo] : []),
        ...(outras.length
          ? ["", "Outras colunas da consulta:", tabela(r.colunas, r.linhas)]
          : []),
      ].join("\n") + aviso + RODAPE;
    }
    const t = comRotuloDaClasse(sql, r.colunas, r.linhas);
    // Série sem gráfico (período e um número): o resumo ajuda do mesmo jeito.
    const numericas = t.colunas.filter((c) => t.linhas.every((l) => ehNumero(l[c])));
    const periodo = t.colunas.find((c) =>
      t.linhas.every((l) => /^\d{4}(-\d{2}){0,2}$/.test(String(l[c]))),
    );
    const semPeriodo = numericas.filter((c) => c !== periodo);
    const resumo =
      periodo && semPeriodo.length === 1 && t.colunas.length === 2
        ? resumoCalculado(
            "serie",
            t.linhas.map((l) => ({
              rotulo: String(l[periodo]),
              valor: l[semPeriodo[0]] as number,
            })),
          )
        : "";
    const previsoes = resumoDasPrevisoes(t.colunas, t.linhas);
    return `${tabela(t.colunas, t.linhas)}${resumo ? `\n\n${resumo}` : ""}${previsoes ? `\n\n${previsoes}` : ""}${aviso}${RODAPE}`;
  },
};

/**
 * A saída de um mapa para o modelo: o resumo e os extremos, não as centenas de
 * linhas. A página busca os valores de todos os municípios em /api/mapa.
 */
function saidaDoMapa(
  colunas: string[],
  linhas: Array<Record<string, unknown>>,
): string {
  const itens = itensDoMapa(colunas, linhas);
  if (typeof itens === "string") return `Erro: ${itens}`;
  const ordenados = [...itens].sort((a, b) => b.valor - a.valor);
  const pontos = ordenados.map((i) => ({ rotulo: i.nome, valor: i.valor }));
  const mostrar = (ls: typeof ordenados) =>
    tabela(
      ["municipio", "valor"],
      ls.map((i) => ({ municipio: i.nome, valor: i.valor })),
    );
  return [
    `Mapa desenhado na página com ${itens.length} municípios (a pessoa vê todos pintados pelo valor). Você recebe só o resumo e os extremos:`,
    "",
    resumoCalculado("ranking", pontos),
    "",
    "Os 10 maiores:",
    mostrar(ordenados.slice(0, 10)),
    "",
    "Os 5 menores:",
    mostrar(ordenados.slice(-5)),
  ].join("\n") + RODAPE;
}

export type ItemDoMapa = { codigo: string; nome: string; valor: number };

let nomesDosMunicipios: Map<string, string> | undefined;

/** As linhas de uma consulta de mapa (codigo, valor), com o nome do município. */
export function itensDoMapa(
  colunas: string[],
  linhas: Array<Record<string, unknown>>,
): ItemDoMapa[] | string {
  const colCodigo = colunas.includes("codigo")
    ? "codigo"
    : colunas.find((c) => linhas.every((l) => /^\d{7}$/.test(String(l[c]))));
  const colValor = colunas.includes("valor")
    ? "valor"
    : colunas.find((c) => c !== colCodigo && linhas.every((l) => ehNumero(l[c])));
  if (!colCodigo || !colValor)
    return `com grafico tipo 'mapa', a consulta tem de devolver as colunas codigo (IBGE de 7 dígitos do município) e valor (número); devolveu ${colunas.join(", ")}.`;
  nomesDosMunicipios ??= new Map(
    (
      db
        .prepare(
          "SELECT codigo, nome || '–' || uf AS nome FROM territorios WHERE tipo = 'municipio'",
        )
        .all() as Array<{ codigo: string; nome: string }>
    ).map((t) => [t.codigo, t.nome]),
  );
  const itens: ItemDoMapa[] = [];
  for (const l of linhas) {
    const codigo = String(l[colCodigo]);
    const nome = nomesDosMunicipios.get(codigo);
    const valor = l[colValor];
    if (nome && ehNumero(valor)) itens.push({ codigo, nome, valor });
  }
  if (itens.length < 2)
    return "o mapa precisa de pelo menos 2 municípios com valor numérico (a coluna codigo é o código IBGE do município, t.codigo).";
  return itens;
}

/** Roda de novo a consulta de um mapa, para a página buscar todos os valores. */
export async function dadosDoMapa(sql: string): Promise<ItemDoMapa[] | string> {
  const invalido = validarSql(sql);
  if (invalido) return invalido;
  const r = await executarSql(sql, LIMITE_MAPA);
  if (!r.ok) return r.erro;
  return itensDoMapa(r.colunas, r.linhas);
}

// --- link "Ver no SEDES" ------------------------------------------------------
//
// Antes era uma ferramenta (link_no_sedes) que o modelo chamava em quase toda
// resposta: uma chamada a mais, às vezes uma ida a mais ao modelo, e o Haiku
// ainda escrevia o link no texto. Agora a página monta o link sozinha, pelas
// consultas que a resposta fez: os índices e o território que aparecem no SQL.

function montarLink(indices: string[], territorio?: string) {
  const params = territorio
    ? new URLSearchParams({
        section: "communication",
        locationKey: territorio,
        period: String(new Date().getFullYear()),
        layers: indices.join(","),
      })
    : new URLSearchParams({ section: "monitoring", layer: indices[0] });
  return `${SITE_URL}/pt/platform?${params}`;
}

let idsDosIndices: Set<string> | undefined;
let codigosDosTerritorios: Map<string, { tipo: string; uf: string | null }> | undefined;

const RECORTE_POR_FILTRO: Array<[RegExp, (m: RegExpExecArray) => string | undefined]> = [
  [/\buf\s*=\s*'([A-Za-z]{2})'/u, (m) => m[1].toLowerCase()],
  [
    /\bregiao\s*=\s*'([^']+)'/u,
    (m) => `2_regiao-${semAcento(m[1]).replace(/\s+/gu, "-")}`,
  ],
  [
    /\bbioma\s*=\s*'([^']+)'/u,
    (m) => `3_bioma-${semAcento(m[1]).replace(/\s+/gu, "-")}`,
  ],
  [/\bsemiarido\s*=\s*1/u, () => "5_semiarido-semiarido-total"],
  [/\basd_entorno\s*=\s*1/u, () => "4_asd-asd-entorno"],
];

/**
 * O link do site para as consultas de uma resposta: os índices escritos no SQL
 * (até 5) e o território. Um território só → o relatório dele; vários
 * municípios do mesmo estado, ou um filtro por estado, região, bioma ou
 * recorte → o relatório desse recorte; sem território → o índice no mapa do
 * Brasil. Devolve null se nenhuma consulta citou um índice.
 */
export function linkDasConsultas(consultas: string[]): string | null {
  idsDosIndices ??= new Set(
    (db.prepare("SELECT id FROM indices").all() as Array<{ id: string }>).map(
      (i) => i.id,
    ),
  );
  codigosDosTerritorios ??= new Map(
    (
      db.prepare("SELECT codigo, tipo, uf FROM territorios").all() as Array<{
        codigo: string;
        tipo: string;
        uf: string | null;
      }>
    ).map((t) => [t.codigo, { tipo: t.tipo, uf: t.uf }]),
  );
  const indices: string[] = [];
  const territorios: string[] = [];
  let recorte: string | undefined;
  for (const sql of consultas) {
    for (const m of sql.matchAll(/'([^']+)'/gu)) {
      const t = m[1];
      if (idsDosIndices.has(t)) {
        if (!indices.includes(t)) indices.push(t);
      } else if (codigosDosTerritorios.has(t) && !territorios.includes(t))
        territorios.push(t);
    }
    for (const [re, chave] of RECORTE_POR_FILTRO) {
      const m = re.exec(sql);
      const c = m && chave(m);
      if (c && codigosDosTerritorios.has(c)) recorte ??= c;
    }
  }
  if (!indices.length) return null;
  let territorio: string | undefined;
  if (territorios.length === 1) territorio = territorios[0];
  else if (territorios.length > 1) {
    const ufs = new Set(
      territorios.map((t) => codigosDosTerritorios!.get(t)?.uf ?? "?"),
    );
    const uf = ufs.size === 1 ? [...ufs][0].toLowerCase() : undefined;
    territorio = uf && codigosDosTerritorios.has(uf) ? uf : recorte;
  } else territorio = recorte;
  return montarLink(indices.slice(0, 5), territorio);
}

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
      return `O site não respondeu (${(error as Error).message}). Responda com o tabelão e diga de quando é o último período dele; não fale em falha nem em meses que "não deu para obter".`;
    }
  },
};

/** Na ordem em que o modelo as vê: não mude à toa, a ordem entra no cache. */
export const FERRAMENTAS: Ferramenta[] = [
  listarIndices,
  detalharIndice,
  buscarTerritorio,
  consultarSql,
  sobreOSedes,
  relatorioTerritorio,
  priorizarMunicipios,
];
