/**
 * Servidor MCP do protótipo de chatbot do SEDES. Todas as ferramentas são só
 * de leitura: o tabelão (data/sedes.sqlite) é aberto em modo read-only e o
 * relatório é um GET na rota que o site já tem.
 *
 * Variáveis de ambiente:
 *   SEDES_BASE_URL   base do site para o relatório (padrão http://localhost:3000)
 *   SEDES_TABELAO    caminho do tabelão (padrão data/sedes.sqlite)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fork, type ChildProcess } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { resumirRelatorio } from "./relatorio.ts";
import { semAcento } from "./texto.ts";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const TABELAO =
  process.env.SEDES_TABELAO ?? path.resolve(AQUI, "../data/sedes.sqlite");
const BASE_URL = (
  process.env.SEDES_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");
const LIMITE_LINHAS = 200;
const PRAZO_SQL_MS = 10_000;
const PRAZO_RELATORIO_MS = 90_000;

if (!existsSync(TABELAO)) {
  console.error(
    `Tabelão não encontrado em ${TABELAO}. Rode "npm run tabelao".`,
  );
  process.exit(1);
}
const db = new DatabaseSync(TABELAO, { readOnly: true });
const DATA_DOS_DADOS = (
  db
    .prepare("SELECT valor FROM metadados WHERE chave = 'data_dos_dados'")
    .get() as {
    valor: string;
  }
).valor.slice(0, 10);
const RODAPE = `\n(Fonte: tabelão do SEDES, dados de ${DATA_DOS_DADOS.split("-").reverse().join("/")}.)`;

function texto(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}

function tabela(colunas: string[], linhas: Array<Record<string, unknown>>) {
  const cel = (v: unknown) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return String(Math.round(v * 100) / 100);
    return String(v).replace(/\s+/g, " ").slice(0, 300);
  };
  return [
    colunas.join(" | "),
    ...linhas.map((l) => colunas.map((c) => cel(l[c])).join(" | ")),
  ].join("\n");
}

// --- SQL num processo filho, que é morto se passar do prazo ---------------
let filho: ChildProcess | null = null;
let proximoId = 1;
function processoSql() {
  if (filho && filho.connected) return filho;
  filho = fork(path.join(AQUI, "sql-filho.ts"), [TABELAO], {
    execArgv: ["--import", import.meta.resolve("tsx"), "--no-warnings"],
    stdio: ["ignore", "ignore", "inherit", "ipc"],
  });
  return filho;
}

type RespostaSql =
  | {
      ok: true;
      colunas: string[];
      linhas: Array<Record<string, unknown>>;
      truncado: boolean;
    }
  | { ok: false; erro: string };

function executarSql(sql: string): Promise<RespostaSql> {
  const proc = processoSql();
  const id = proximoId++;
  return new Promise((resolve) => {
    const prazo = setTimeout(() => {
      proc.off("message", ouvir);
      proc.kill("SIGKILL");
      filho = null;
      resolve({
        ok: false,
        erro: `A consulta passou de ${PRAZO_SQL_MS / 1000} s e foi cancelada. Filtre por indice e periodo (são as colunas indexadas) e evite varrer todos os períodos de um índice mensal.`,
      });
    }, PRAZO_SQL_MS);
    function ouvir(msg: RespostaSql & { id: number }) {
      if (msg.id !== id) return;
      clearTimeout(prazo);
      proc.off("message", ouvir);
      resolve(msg);
    }
    proc.on("message", ouvir);
    proc.send({ id, sql, limite: LIMITE_LINHAS });
  });
}

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

// --- servidor ---------------------------------------------------------------
const server = new McpServer({ name: "sedes", version: "0.1.0" });

server.registerTool(
  "listar_indices",
  {
    title: "Catálogo de índices do SEDES",
    description:
      "Lista os índices do tabelão do SEDES: id, nome, categoria, escala temporal, primeiro e último período, o que o valor significa, unidade, observações de qualidade e as classes de cada um. Chame antes de escrever SQL, para saber o id do índice e a ordem das classes. Também informa a data dos dados.",
    inputSchema: {},
  },
  async () => {
    const indices = db
      .prepare(
        "SELECT id, nome, categoria, escala_temporal, primeiro_periodo, ultimo_periodo, qtd_periodos, tipo_valor, significado_valor, unidade, id_no_relatorio, observacao FROM indices ORDER BY categoria, nome",
      )
      .all() as Array<Record<string, string | number>>;
    const classes = db.prepare(
      "SELECT ordem, rotulo FROM classes WHERE indice = ? ORDER BY ordem",
    );
    const partes = [
      `Data dos dados do tabelão: ${DATA_DOS_DADOS} (snapshot antigo; pode haver dados mais novos no site).`,
      "",
    ];
    for (const i of indices) {
      const cls = (
        classes.all(i.id) as Array<{ ordem: number; rotulo: string }>
      )
        .map((c) => `${c.ordem}=${c.rotulo}`)
        .join(", ");
      partes.push(
        `## ${i.nome} (id: ${i.id})`,
        `Categoria: ${i.categoria}. Escala: ${i.escala_temporal}. Períodos: ${i.primeiro_periodo} a ${i.ultimo_periodo} (${i.qtd_periodos}).`,
        `Valor: ${i.significado_valor} Unidade: ${i.unidade}. Tipo: ${i.tipo_valor}.`,
        `Classes (coluna classe): ${cls}`,
        `Observação: ${i.observacao}`,
        `Id no relatório do site: ${i.id_no_relatorio ?? "não existe"}`,
        "",
      );
    }
    return texto(partes.join("\n"));
  },
);

server.registerTool(
  "buscar_territorio",
  {
    title: "Buscar território pelo nome",
    description:
      "Procura municípios, estados, regiões, biomas e outros recortes pelo nome, sem diferenciar acento ou maiúscula. Devolve TODOS os homônimos com UF; se houver mais de um município com o nome, pergunte ao usuário qual é (ou liste as opções). O campo codigo é o que se usa na coluna valores.territorio e na ferramenta relatorio_territorio.",
    inputSchema: {
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
  },
  async ({ nome, uf }) => {
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
      return texto(
        `Nenhum território do SEDES tem nome parecido com "${nome}"${uf ? ` na UF ${uf}` : ""}.`,
      );
    }
    const municipios = linhas.filter((l) => l.tipo === "municipio").length;
    const aviso =
      modo === "nome exato" && municipios > 1
        ? `\nATENÇÃO: ${municipios} municípios com esse nome. Pergunte ao usuário a UF antes de responder.`
        : "";
    return texto(
      `Busca por ${modo}:\n${tabela(["codigo", "nome", "tipo", "uf", "regiao", "bioma", "semiarido"], linhas)}${aviso}`,
    );
  },
);

const ESQUEMA = `Banco SQLite só leitura (o tabelão do SEDES). Tabelas:
- indices(id, nome, descricao, categoria, escala_temporal, primeiro_periodo, ultimo_periodo, qtd_periodos, tipo_valor, significado_valor, unidade, id_no_relatorio, observacao)
- classes(indice, ordem, rotulo)  -- ordem começa em 1
- territorios(codigo, nome, nome_sem_acento, tipo, uf, regiao, bioma, semiarido, asd_entorno)
    tipo: 'municipio' | 'estado' | 'pais' | 'regiao' | 'bioma' | 'semiarido' | 'asd' | 'lagoa'
    codigo: IBGE de 7 dígitos (município), sigla minúscula ('pb') para estado, 'br', '2_regiao-nordeste', '3_bioma-caatinga', '5_semiarido-semiarido-total', '4_asd-asd-entorno'
    uf: sigla MAIÚSCULA ('PB'). bioma: bioma predominante do município. semiarido / asd_entorno: 1 ou 0 (só municípios)
- valores(indice, periodo, ano, mes, territorio, classe, valor)  -- formato longo: uma linha por classe
    periodo: 'AAAA' (anual) ou 'AAAA-MM' (mensal). valor já está na unidade final (% da área, % de famílias ou contagem; veja listar_indices).
    Linha ausente = sem dado para aquele território e período.
- valores_com_nomes: visão de valores com nome_territorio, tipo_territorio, uf e rotulo_classe.
- metadados(chave, valor)  -- 'data_dos_dados'

Desempenho: a chave é (indice, periodo, territorio, classe) e há índice em (territorio, indice, periodo). Sempre filtre por indice e, em rankings, por periodo exato ou faixa (periodo BETWEEN '2025-01' AND '2025-12'); filtrar só por ano varre a tabela inteira.
A tabela valores mistura municípios, estados e recortes: para contar ou ranquear municípios, junte com territorios e filtre t.tipo = 'municipio'.
Estados e Brasil têm valor próprio em valores para todos os índices; use-o em vez de somar municípios.
Região, bioma, Semiárido e ASD só têm valor próprio para 'anaseca' e 'prev_anomalia_precipitacao'. Para os demais índices nesses recortes, prefira relatorio_territorio; se calcular a média dos municípios, diga que é média simples, sem pesar pela área.

Exemplos:
1) Distribuição de um município num mês:
   SELECT rotulo_classe, valor FROM valores_com_nomes WHERE indice='anaseca' AND periodo='2026-04' AND territorio='2504009' ORDER BY classe;
2) Ranking: municípios do Semiárido com maior % de área em seca grave ou pior no Monitor de Secas:
   SELECT t.nome, t.uf, SUM(v.valor) AS pct FROM valores v JOIN territorios t ON t.codigo=v.territorio
   WHERE v.indice='anaseca' AND v.periodo='2026-04' AND v.classe >= 4 AND t.tipo='municipio' AND t.semiarido=1
   GROUP BY t.codigo ORDER BY pct DESC LIMIT 10;
3) Série histórica de pobreza de um município:
   SELECT periodo, valor FROM valores WHERE indice='pob_total' AND territorio='2504009' ORDER BY periodo;`;

server.registerTool(
  "consultar_sql",
  {
    title: "Consultar o tabelão com SQL",
    description: `Roda uma consulta SELECT/WITH (SQLite) no tabelão do SEDES e devolve até ${LIMITE_LINHAS} linhas. Tempo máximo ${PRAZO_SQL_MS / 1000} s. Erros voltam como texto: corrija a consulta e tente de novo.\n\n${ESQUEMA}`,
    inputSchema: {
      sql: z.string().min(6).describe("Uma consulta SELECT ou WITH"),
    },
  },
  async ({ sql }) => {
    const invalido = validarSql(sql);
    if (invalido) return texto(`Erro: ${invalido}`);
    const r = await executarSql(sql);
    if (!r.ok) return texto(`Erro: ${r.erro}`);
    if (!r.linhas.length)
      return texto(
        `Nenhuma linha. (Linha ausente = sem dado para aquele filtro.)${RODAPE}`,
      );
    const aviso = r.truncado
      ? `\n(Mostrando só as primeiras ${LIMITE_LINHAS} linhas; refine a consulta.)`
      : "";
    return texto(`${tabela(r.colunas, r.linhas)}${aviso}${RODAPE}`);
  },
);

server.registerTool(
  "relatorio_territorio",
  {
    title: "Relatório atual do site para um território",
    description: `Chama o relatório da plataforma SEDES (${BASE_URL}), que calcula na hora pelo Earth Engine o dado mais atual de ~40 índices (incluindo previsões, PIB, IDH, analfabetismo, PRODES, solos), mais do que o tabelão tem. É lento (5 a 15 s por chamada) e usa a fila do Earth Engine: use só como complemento, quando o tabelão não tiver o índice ou o período pedido, ou quando o usuário quiser o dado mais recente. Devolve um resumo por índice: período efetivo e classes com área. Com o parâmetro indice, mostra também os últimos 12 períodos daquele índice.`,
    inputSchema: {
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
  },
  async ({ chave, periodo, indice }) => {
    const url = `${BASE_URL}/api/municipal-report/${encodeURIComponent(chave)}?period=${periodo}`;
    try {
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(PRAZO_RELATORIO_MS),
      });
      if (resp.status === 404)
        return texto(
          `O site não reconhece o território "${chave}" (404). Use buscar_territorio para achar o código.`,
        );
      if (resp.status === 400)
        return texto(
          `Chave ou período em formato inválido (400): chave="${chave}", periodo="${periodo}".`,
        );
      if (resp.status === 401 || resp.status === 403)
        return texto(
          `O site pediu login (${resp.status}). O servidor precisa rodar com PLATFORM_ACCESS_GUARD_ENABLED=false.`,
        );
      if (!resp.ok)
        return texto(
          `O relatório falhou com HTTP ${resp.status}. Responda com o tabelão e diga que o dado atual não pôde ser obtido.`,
        );
      return texto(resumirRelatorio(await resp.json(), indice));
    } catch (error) {
      return texto(
        `Não consegui falar com o site em ${BASE_URL}: ${(error as Error).message}. Responda com o tabelão e diga que o dado atual não pôde ser obtido.`,
      );
    }
  },
);

process.on("exit", () => filho?.kill("SIGKILL"));
await server.connect(new StdioServerTransport());
