/**
 * Página de chat local do bot do SEDES (npm run chat → http://localhost:3210).
 *
 * O navegador não fala com o modelo direto: este servidor abre um `claude` por
 * conversa, com as mesmas opções do conversar.sh (lidas do comum.sh, para não
 * haver duas versões), e repassa a resposta para a página enquanto ela é
 * escrita. Assim a conversa segue na assinatura de quem roda, com as mesmas
 * ferramentas e o mesmo prompt.
 *
 * Cada pergunta é gravada em conversas/<data>_<id>.jsonl (fora do git): a
 * pergunta, a resposta, cada ferramenta com entrada e saída, o tempo, os
 * tokens e a avaliação 👍/👎 com comentário.
 *
 * Variáveis de ambiente:
 *   SEDES_CHAT_PORTA  porta da página (padrão 3210)
 *   SEDES_BASE_URL    site usado pela ferramenta de relatório (padrão http://localhost:3000)
 */
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import http from "node:http";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PACOTE = path.resolve(AQUI, "../..");
const RAIZ = path.resolve(PACOTE, "../..");
const PAGINA = path.join(AQUI, "pagina");
const CONVERSAS = path.join(PACOTE, "conversas");
const PORTA = Number(process.env.SEDES_CHAT_PORTA ?? 3210);
const ORIGEM = `http://localhost:${PORTA}`;
const OCIOSA_MS = 20 * 60_000;
const SAIDA_MAX = 6_000;
// Pergunta maior que isto não é pergunta sobre dados; também limita o gasto.
const PERGUNTA_MAX = 2_000;

mkdirSync(CONVERSAS, { recursive: true });

// ---------------------------------------------------------------------------
// Opções do claude: as mesmas do conversar.sh, tiradas do comum.sh.

type Opcoes = {
  sessao: string;
  modelos: Record<string, string>;
  args: string[];
};

function lerOpcoes(): Opcoes {
  const saida = execFileSync(
    "bash",
    [
      "-c",
      'source "$1" >&2; printf "%s\\0" "$SESSAO" "$(modelo_id sonnet)" "$(modelo_id haiku)" "${OPCOES_CLAUDE[@]}"',
      "_",
      path.join(PACOTE, "comum.sh"),
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  const [sessao, sonnet, haiku, ...args] = saida.split("\0").slice(0, -1);
  return { sessao, modelos: { sonnet, haiku }, args };
}

let opcoes = lerOpcoes();
let opcoesDoDia = new Date().toDateString();
function opcoesAtuais() {
  // O prompt leva a data de hoje; relê se o servidor atravessou a meia-noite.
  if (new Date().toDateString() !== opcoesDoDia) {
    opcoes = lerOpcoes();
    opcoesDoDia = new Date().toDateString();
  }
  return opcoes;
}

const tabelaoGeradoEm = (() => {
  try {
    const db = new DatabaseSync(path.join(PACOTE, "data/sedes.sqlite"), {
      readOnly: true,
    });
    const r = db
      .prepare("SELECT valor FROM metadados WHERE chave = 'gerado_em'")
      .get() as { valor: string } | undefined;
    db.close();
    return r?.valor ?? null;
  } catch {
    return null;
  }
})();

// ---------------------------------------------------------------------------
// Conversas

type Evento = Record<string, unknown> & { tipo: string };

type Ferramenta = {
  id: string;
  nome: string;
  entrada: unknown;
  saida?: string;
  erro?: boolean;
  inicio: number;
  ms?: number;
};

type Turno = {
  numero: number;
  pergunta: string;
  resposta: string;
  ferramentas: Ferramenta[];
  inicio: number;
  enviar: (e: Evento) => void;
  fechar: () => void;
  separar: boolean;
};

type Conversa = {
  id: string;
  modelo: string;
  arquivo: string;
  sessionId?: string;
  proc?: ChildProcess;
  turno?: Turno;
  turnos: number;
  ociosa?: NodeJS.Timeout;
};

const conversas = new Map<string, Conversa>();

// Linhas do arquivo de cada conversa (ver o README).
type RegistroInicio = {
  tipo: "inicio";
  id: string;
  modelo: string;
  em: string;
};
type RegistroTurno = {
  tipo: "turno";
  turno: number;
  session_id?: string;
  pergunta: string;
  resposta: string;
  ferramentas?: Array<Omit<Ferramenta, "inicio">>;
  ms?: number;
  interrompida?: boolean;
  erro?: string | null;
  em: string;
};
type RegistroAvaliacao = {
  tipo: "avaliacao";
  turno: number;
  nota: "bom" | "ruim" | null;
  comentario?: string;
};
type Registro = RegistroInicio | RegistroTurno | RegistroAvaliacao;

const inicioDe = (regs: Registro[]) =>
  regs.find((r): r is RegistroInicio => r.tipo === "inicio");
const turnosDe = (regs: Registro[]) =>
  regs.filter((r): r is RegistroTurno => r.tipo === "turno");

/** Linha do stream-json do claude: só os campos que este servidor usa. */
type Bloco = {
  type: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string | Array<{ text?: string }>;
  is_error?: boolean;
};
type MensagemClaude = {
  type: string;
  session_id?: string;
  event?: {
    type: string;
    content_block?: { type: string; name?: string };
    delta?: { type: string; text?: string };
  };
  message?: { content?: string | Bloco[] };
  duration_ms?: number;
  total_cost_usd?: number;
  usage?: unknown;
  is_error?: boolean;
  result?: string;
};

function gravar(c: Conversa, registro: Record<string, unknown>) {
  appendFileSync(
    c.arquivo,
    JSON.stringify({ ...registro, em: new Date().toISOString() }) + "\n",
  );
}

function lerRegistros(arquivo: string): Registro[] {
  return readFileSync(arquivo, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l)];
      } catch {
        return [];
      }
    });
}

function arquivoDaConversa(id: string) {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  const nome = readdirSync(CONVERSAS).find((f) => f.endsWith(`_${id}.jsonl`));
  return nome ? path.join(CONVERSAS, nome) : null;
}

/** Conversa em memória, ou reaberta do arquivo (para continuar com --resume). */
function obterConversa(id: string): Conversa | null {
  const viva = conversas.get(id);
  if (viva) return viva;
  const arquivo = arquivoDaConversa(id);
  if (!arquivo) return null;
  const regs = lerRegistros(arquivo);
  const inicio = inicioDe(regs);
  const turnos = turnosDe(regs);
  const c: Conversa = {
    id,
    modelo: inicio?.modelo ?? "sonnet",
    arquivo,
    sessionId: turnos.findLast((t) => t.session_id)?.session_id,
    turnos: turnos.length,
  };
  conversas.set(id, c);
  return c;
}

function novaConversa(modelo: string): Conversa {
  const id = randomUUID().slice(0, 8);
  const carimbo = new Date()
    .toLocaleString("sv-SE", { timeZone: "America/Fortaleza" })
    .replace(" ", "T")
    .replaceAll(":", "-");
  const c: Conversa = {
    id,
    modelo,
    arquivo: path.join(CONVERSAS, `${carimbo}_${id}.jsonl`),
    turnos: 0,
  };
  conversas.set(id, c);
  gravar(c, { tipo: "inicio", id, modelo, modelo_id: opcoes.modelos[modelo] });
  return c;
}

// Processos encerrados por nós (botão Parar ou conversa ociosa): a saída deles
// não é erro. O claude sai com código 143, então o sinal não serve para saber.
const encerrados = new WeakSet<ChildProcess>();

function encerrarProcesso(c: Conversa) {
  clearTimeout(c.ociosa);
  if (c.proc) encerrados.add(c.proc);
  c.proc?.kill("SIGTERM");
  c.proc = undefined;
}

function iniciarProcesso(c: Conversa) {
  const o = opcoesAtuais();
  const args = [
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--model",
    o.modelos[c.modelo] ?? c.modelo,
    ...o.args,
    ...(c.sessionId ? ["--resume", c.sessionId] : []),
  ];
  const proc = spawn("claude", args, {
    cwd: o.sessao,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      SEDES_BASE_URL: process.env.SEDES_BASE_URL ?? "http://localhost:3000",
    },
  });
  c.proc = proc;
  let erros = "";
  proc.stderr!.on("data", (d) => {
    erros = (erros + d).slice(-2000);
  });
  createInterface({ input: proc.stdout! }).on("line", (linha) => {
    let msg: MensagemClaude;
    try {
      msg = JSON.parse(linha);
    } catch {
      return;
    }
    tratarMensagem(c, msg);
  });
  proc.on("exit", (codigo, sinal) => {
    if (c.proc === proc) c.proc = undefined;
    if (c.turno) {
      const motivo = encerrados.has(proc)
        ? null
        : `O processo do claude parou (código ${codigo ?? sinal}). ${erros.trim().slice(-400)}`;
      terminarTurno(c, { interrompida: true, erro: motivo });
    }
  });
}

function tratarMensagem(c: Conversa, msg: MensagemClaude) {
  if (msg.session_id) c.sessionId = msg.session_id;
  const t = c.turno;
  if (!t) return;

  if (msg.type === "stream_event") {
    const ev = msg.event;
    if (ev?.type === "content_block_start") {
      const tipo = ev.content_block?.type;
      if (tipo === "text" && t.resposta) t.separar = true;
      if (tipo === "thinking") t.enviar({ tipo: "pensando" });
      if (tipo === "tool_use")
        t.enviar({ tipo: "preparando", nome: ev.content_block?.name });
    }
    if (ev?.type === "content_block_delta" && ev.delta?.type === "text_delta") {
      let pedaco = ev.delta.text ?? "";
      if (t.separar) {
        pedaco = "\n\n" + pedaco;
        t.separar = false;
      }
      t.resposta += pedaco;
      t.enviar({ tipo: "texto", t: pedaco });
    }
    return;
  }

  if (msg.type === "assistant") {
    const blocos = Array.isArray(msg.message?.content)
      ? msg.message.content
      : [];
    for (const b of blocos) {
      if (b.type !== "tool_use" || !b.id) continue;
      const f: Ferramenta = {
        id: b.id,
        nome: String(b.name).replace(/^mcp__sedes__/, ""),
        entrada: b.input,
        inicio: Date.now(),
      };
      t.ferramentas.push(f);
      t.enviar({
        tipo: "ferramenta",
        id: f.id,
        nome: f.nome,
        entrada: f.entrada,
      });
    }
    return;
  }

  if (msg.type === "user") {
    const blocos = Array.isArray(msg.message?.content)
      ? msg.message.content
      : [];
    for (const b of blocos) {
      if (b.type !== "tool_result") continue;
      const f = t.ferramentas.find((x) => x.id === b.tool_use_id);
      if (!f) continue;
      const texto = Array.isArray(b.content)
        ? b.content.map((x) => x.text ?? "").join("\n")
        : String(b.content ?? "");
      f.saida = texto;
      f.erro = Boolean(b.is_error);
      f.ms = Date.now() - f.inicio;
      t.enviar({
        tipo: "saida",
        id: f.id,
        texto: texto.slice(0, SAIDA_MAX),
        cortada: texto.length > SAIDA_MAX,
        erro: f.erro,
        ms: f.ms,
      });
    }
    return;
  }

  if (msg.type === "result") {
    terminarTurno(c, {
      ms: msg.duration_ms,
      custo_usd: msg.total_cost_usd,
      uso: msg.usage,
      erro: msg.is_error ? String(msg.result ?? "erro") : null,
    });
  }
}

function terminarTurno(
  c: Conversa,
  extra: {
    ms?: number;
    custo_usd?: number;
    uso?: unknown;
    erro?: string | null;
    interrompida?: boolean;
  },
) {
  const t = c.turno;
  if (!t) return;
  c.turno = undefined;
  const ms = extra.ms ?? Date.now() - t.inicio;
  gravar(c, {
    tipo: "turno",
    turno: t.numero,
    modelo: c.modelo,
    session_id: c.sessionId,
    pergunta: t.pergunta,
    resposta: t.resposta,
    ferramentas: t.ferramentas.map((f) => ({ ...f, inicio: undefined })),
    ms,
    custo_usd: extra.custo_usd,
    uso: extra.uso,
    interrompida: extra.interrompida ?? false,
    erro: extra.erro ?? null,
  });
  t.enviar({
    tipo: "fim",
    turno: t.numero,
    ms,
    interrompida: extra.interrompida ?? false,
    erro: extra.erro ?? null,
  });
  t.fechar();
  clearTimeout(c.ociosa);
  c.ociosa = setTimeout(() => encerrarProcesso(c), OCIOSA_MS);
}

// ---------------------------------------------------------------------------
// HTTP

const TIPOS: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const ESTATICOS: Record<string, string> = {
  "/": path.join(PAGINA, "index.html"),
  "/estilo.css": path.join(PAGINA, "estilo.css"),
  "/app.js": path.join(PAGINA, "app.js"),
  "/grafico.js": path.join(PAGINA, "grafico.js"),
  "/marked.js": path.join(PACOTE, "node_modules/marked/lib/marked.esm.js"),
  "/logo.svg": path.join(RAIZ, "public/logo-sedes.svg"),
  "/favicon.svg": path.join(RAIZ, "public/favicon.svg"),
};

function json(res: http.ServerResponse, status: number, corpo: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(corpo));
}

async function lerCorpo(
  req: http.IncomingMessage,
): Promise<Record<string, unknown>> {
  let s = "";
  for await (const pedaco of req) {
    s += pedaco;
    if (s.length > 100_000) throw new Error("corpo grande demais");
  }
  return s ? JSON.parse(s) : {};
}

function listarConversas() {
  return readdirSync(CONVERSAS)
    .filter((f) => f.endsWith(".jsonl"))
    .sort()
    .reverse()
    .map((f) => {
      const regs = lerRegistros(path.join(CONVERSAS, f));
      const inicio = inicioDe(regs);
      const turnos = turnosDe(regs);
      const notas = notasPorTurno(regs);
      return {
        id: inicio?.id ?? f.replace(/^.*_|\.jsonl$/g, ""),
        modelo: inicio?.modelo,
        em: inicio?.em,
        titulo: turnos[0]?.pergunta?.slice(0, 120) ?? "",
        turnos: turnos.length,
        bons: [...notas.values()].filter((n) => n.nota === "bom").length,
        ruins: [...notas.values()].filter((n) => n.nota === "ruim").length,
      };
    })
    .filter((c) => c.turnos > 0);
}

function notasPorTurno(regs: Registro[]) {
  const notas = new Map<number, { nota: string | null; comentario: string }>();
  for (const r of regs)
    if (r.tipo === "avaliacao")
      notas.set(r.turno, { nota: r.nota, comentario: r.comentario ?? "" });
  return notas;
}

const servidor = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", ORIGEM);

    if (req.method === "GET" && ESTATICOS[url.pathname]) {
      const arquivo = ESTATICOS[url.pathname];
      res.writeHead(200, {
        "content-type": TIPOS[path.extname(arquivo)] ?? TIPOS[".html"],
        "cache-control": "no-cache",
      });
      res.end(readFileSync(arquivo));
      return;
    }

    if (req.method === "POST") {
      // Só a própria página pode pedir: outro site aberto no navegador não
      // consegue gastar a assinatura mandando perguntas para cá.
      const origem = req.headers.origin;
      if (
        origem &&
        origem !== ORIGEM &&
        origem !== `http://127.0.0.1:${PORTA}`
      ) {
        json(res, 403, { erro: "origem não permitida" });
        return;
      }
    }

    if (req.method === "GET" && url.pathname === "/api/info") {
      json(res, 200, { tabelaoGeradoEm, modelos: opcoes.modelos });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/conversas") {
      json(res, 200, listarConversas());
      return;
    }

    const m = url.pathname.match(/^\/api\/conversas\/([a-z0-9-]+)$/);
    if (req.method === "GET" && m) {
      const arquivo = arquivoDaConversa(m[1]);
      if (!arquivo) return json(res, 404, { erro: "conversa não encontrada" });
      const regs = lerRegistros(arquivo);
      const notas = notasPorTurno(regs);
      json(res, 200, {
        id: m[1],
        modelo: inicioDe(regs)?.modelo,
        turnos: turnosDe(regs).map((r) => ({
          turno: r.turno,
          pergunta: r.pergunta,
          resposta: r.resposta,
          ferramentas: (r.ferramentas ?? []).map((f) => ({
            ...f,
            saida: f.saida?.slice(0, SAIDA_MAX),
          })),
          ms: r.ms,
          interrompida: r.interrompida,
          erro: r.erro,
          avaliacao: notas.get(r.turno) ?? null,
        })),
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/mensagem") {
      const corpo = await lerCorpo(req);
      const texto = String(corpo.texto ?? "").trim();
      if (!texto) return json(res, 400, { erro: "pergunta vazia" });
      if (texto.length > PERGUNTA_MAX)
        return json(res, 400, {
          erro: `a pergunta passou de ${PERGUNTA_MAX} caracteres; resuma e tente de novo`,
        });
      const modelo = corpo.modelo === "haiku" ? "haiku" : "sonnet";
      const c = corpo.conversa
        ? obterConversa(String(corpo.conversa))
        : novaConversa(modelo);
      if (!c) return json(res, 404, { erro: "conversa não encontrada" });
      if (c.turno)
        return json(res, 409, { erro: "a conversa ainda está respondendo" });

      res.writeHead(200, {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-cache",
      });
      const enviar = (e: Evento) => {
        if (!res.writableEnded) res.write(JSON.stringify(e) + "\n");
      };
      c.turnos += 1;
      c.turno = {
        numero: c.turnos,
        pergunta: texto,
        resposta: "",
        ferramentas: [],
        inicio: Date.now(),
        enviar,
        fechar: () => res.end(),
        separar: false,
      };
      enviar({ tipo: "conversa", id: c.id, modelo: c.modelo, turno: c.turnos });
      clearTimeout(c.ociosa);
      if (!c.proc) iniciarProcesso(c);
      c.proc!.stdin!.write(
        JSON.stringify({
          type: "user",
          message: { role: "user", content: texto },
        }) + "\n",
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/parar") {
      const corpo = await lerCorpo(req);
      const c = conversas.get(String(corpo.conversa));
      if (c?.turno) encerrarProcesso(c);
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/avaliacao") {
      const corpo = await lerCorpo(req);
      const c = obterConversa(String(corpo.conversa));
      if (!c) return json(res, 404, { erro: "conversa não encontrada" });
      const nota =
        corpo.nota === "bom" || corpo.nota === "ruim" ? corpo.nota : null;
      gravar(c, {
        tipo: "avaliacao",
        turno: Number(corpo.turno),
        nota,
        comentario: String(corpo.comentario ?? "").slice(0, 4000),
      });
      json(res, 200, { ok: true });
      return;
    }

    json(res, 404, { erro: "não encontrado" });
  } catch (e) {
    if (!res.headersSent) json(res, 500, { erro: String(e) });
    else res.end();
  }
});

for (const sinal of ["SIGINT", "SIGTERM"] as const)
  process.on(sinal, () => {
    for (const c of conversas.values()) encerrarProcesso(c);
    process.exit(0);
  });

servidor.listen(PORTA, "127.0.0.1", () => {
  console.log(`Chat do SEDES em ${ORIGEM}`);
  console.log(`Conversas gravadas em ${CONVERSAS}`);
  if (!existsSync(path.join(PACOTE, "data/sedes.sqlite")))
    console.log("Aviso: falta o tabelão (npm run tabelao).");
});
