/**
 * Página de chat do bot do SEDES (npm run chat → http://localhost:3210).
 *
 * O navegador não fala com o modelo direto: este servidor recebe a pergunta,
 * passa para um motor e repassa a resposta para a página enquanto ela é
 * escrita. Há dois motores, com as mesmas ferramentas e o mesmo prompt:
 *   api     a API da Anthropic, com ANTHROPIC_API_KEY (motor-api.ts). É o do beta.
 *   claude  o `claude` da linha de comando, na assinatura de quem roda
 *           (motor-claude.ts). Bom para testar no computador, sem chave.
 *
 * Cada pergunta é gravada em conversas/<data>_<id>.jsonl (fora do git): a
 * pergunta, a resposta, cada ferramenta com entrada e saída, o tempo, os
 * tokens, o custo e a avaliação 👍/👎 com comentário. Com login, a conversa
 * guarda o e-mail de quem perguntou, e cada pessoa vê só as próprias.
 *
 * Variáveis de ambiente:
 *   SEDES_CHAT_PORTA      porta da página (padrão 3210)
 *   SEDES_CHAT_HOST       endereço em que escuta (padrão 127.0.0.1)
 *   SEDES_CHAT_ORIGEM     endereço público da página, ex.: https://beta-sap.lsd.ufcg.edu.br
 *   SEDES_CHAT_MOTOR      api | claude (padrão: api se houver ANTHROPIC_API_KEY)
 *   SEDES_CHAT_MODELOS    modelos oferecidos, o primeiro é o padrão (padrão haiku,sonnet)
 *   SEDES_CHAT_CONVERSAS  pasta das conversas (padrão conversas/)
 *   SEDES_BASE_URL        site usado pela ferramenta de relatório (padrão http://localhost:3000)
 *   e as de acesso.ts (login), limites.ts (limites), motor-api.ts e ferramentas.ts.
 */
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
import { fileURLToPath } from "node:url";
import { GERADO_EM, TABELAO } from "../ferramentas.ts";
import { criarAcesso, type Acesso } from "./acesso.ts";
import { criarLimites } from "./limites.ts";
import { criarMotorApi } from "./motor-api.ts";
import { criarMotorClaude } from "./motor-claude.ts";
import {
  SAIDA_MAX,
  Turno,
  type Evento,
  type FimDoTurno,
  type Motor,
} from "./turno.ts";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PACOTE = path.resolve(AQUI, "../..");
const RAIZ = path.resolve(PACOTE, "../..");
const PAGINA = path.join(AQUI, "pagina");
const CONVERSAS = path.resolve(
  process.env.SEDES_CHAT_CONVERSAS ?? path.join(PACOTE, "conversas"),
);
const PORTA = Number(process.env.SEDES_CHAT_PORTA ?? 3210);
const HOST = process.env.SEDES_CHAT_HOST ?? "127.0.0.1";
const LOCAL = HOST === "127.0.0.1" || HOST === "localhost" || HOST === "::1";
// Pergunta maior que isto não é pergunta sobre dados; também limita o gasto.
const PERGUNTA_MAX = 2_000;
// Conversa longa reenvia todo o histórico a cada pergunta: fica cara e lenta.
const TURNOS_MAX = 30;

const ORIGENS = new Set([
  `http://localhost:${PORTA}`,
  `http://127.0.0.1:${PORTA}`,
  ...(process.env.SEDES_CHAT_ORIGEM ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean),
]);

mkdirSync(CONVERSAS, { recursive: true });

const acesso = criarAcesso();
if (!LOCAL && !acesso.comLogin) {
  console.error(
    `A página escutaria em ${HOST} sem login. Defina SEDES_CHAT_EMAILS (quem pode usar) ou use SEDES_CHAT_HOST=127.0.0.1.`,
  );
  process.exit(1);
}

const nomeDoMotor =
  process.env.SEDES_CHAT_MOTOR ??
  (process.env.ANTHROPIC_API_KEY ? "api" : "claude");
const motor: Motor =
  nomeDoMotor === "api" ? criarMotorApi() : criarMotorClaude();
const MODELOS = (process.env.SEDES_CHAT_MODELOS ?? "haiku,sonnet")
  .split(",")
  .map((m) => m.trim())
  .filter((m) => motor.modelos[m]);
if (!MODELOS.length) {
  console.error(
    "SEDES_CHAT_MODELOS não tem nenhum modelo conhecido (haiku, sonnet).",
  );
  process.exit(1);
}

// O teto de gasto vale para a chave da API; no motor "claude" a conversa
// corre na assinatura de quem roda, e o custo que ele informa é só estimativa.
const limites = criarLimites(CONVERSAS, {
  ...process.env,
  SEDES_CHAT_TETO_DIARIO_USD:
    process.env.SEDES_CHAT_TETO_DIARIO_USD ??
    (motor.nome === "api" ? "2" : "0"),
});

// ---------------------------------------------------------------------------
// Conversas

type Conversa = {
  id: string;
  modelo: string;
  arquivo: string;
  email?: string;
  turno?: Turno;
  turnos: number;
};

const conversas = new Map<string, Conversa>();

// Linhas do arquivo de cada conversa (ver o README).
type RegistroInicio = {
  tipo: "inicio";
  id: string;
  modelo: string;
  email?: string;
  em: string;
};
type RegistroTurno = {
  tipo: "turno";
  turno: number;
  session_id?: string;
  pergunta: string;
  resposta: string;
  ferramentas?: Array<Record<string, unknown> & { saida?: string }>;
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

/** Com login, cada pessoa só vê e continua as próprias conversas. */
const dono = (email: string | undefined, donoDaConversa: string | undefined) =>
  !acesso.comLogin || (email !== undefined && email === donoDaConversa);

/** Conversa em memória, ou reaberta do arquivo. */
function obterConversa(id: string, email: string | undefined): Conversa | null {
  const viva = conversas.get(id);
  if (viva) return dono(email, viva.email) ? viva : null;
  const arquivo = arquivoDaConversa(id);
  if (!arquivo) return null;
  const regs = lerRegistros(arquivo);
  const inicio = inicioDe(regs);
  if (!dono(email, inicio?.email)) return null;
  const c: Conversa = {
    id,
    modelo: inicio?.modelo ?? MODELOS[0],
    arquivo,
    email: inicio?.email,
    turnos: turnosDe(regs).length,
  };
  conversas.set(id, c);
  return c;
}

function novaConversa(modelo: string, email: string | undefined): Conversa {
  const id = randomUUID().slice(0, 8);
  const carimbo = new Date()
    .toLocaleString("sv-SE", { timeZone: "America/Fortaleza" })
    .replace(" ", "T")
    .replaceAll(":", "-");
  const c: Conversa = {
    id,
    modelo,
    arquivo: path.join(CONVERSAS, `${carimbo}_${id}.jsonl`),
    email,
    turnos: 0,
  };
  conversas.set(id, c);
  gravar(c, {
    tipo: "inicio",
    id,
    modelo,
    modelo_id: motor.modelos[modelo],
    motor: motor.nome,
    ...(email ? { email } : {}),
  });
  return c;
}

function registrarFim(
  c: Conversa,
  t: Turno,
  fim: FimDoTurno,
  enviar: (e: Evento) => void,
  fechar: () => void,
) {
  if (c.turno === t) c.turno = undefined;
  const ms = fim.ms ?? Date.now() - t.inicio;
  gravar(c, {
    tipo: "turno",
    turno: t.numero,
    modelo: c.modelo,
    session_id: fim.session_id,
    pergunta: t.pergunta,
    resposta: t.resposta,
    ferramentas: t.ferramentas.map((f) => ({ ...f, inicio: undefined })),
    ms,
    custo_usd: fim.custo_usd,
    uso: fim.uso,
    interrompida: fim.interrompida ?? false,
    erro: fim.erro ?? null,
  });
  limites.contarGasto(fim.custo_usd);
  enviar({
    tipo: "fim",
    turno: t.numero,
    ms,
    interrompida: fim.interrompida ?? false,
    erro: fim.erro ?? null,
  });
  fechar();
}

// ---------------------------------------------------------------------------
// HTTP

const TIPOS: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

// Os endereços são relativos na página: no beta ela fica em /chat/.
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

function paginaDeAcesso(res: http.ServerResponse, a: Acesso) {
  const corpo =
    a.situacao === "sem-permissao"
      ? `<p>A conta <strong>${a.email.replace(/[<>&"]/g, "")}</strong> ainda não tem acesso ao assistente de dados, que está em teste com a equipe.</p><p>Peça acesso a quem cuida do SEDES.</p>`
      : `<p>O assistente de dados está em teste com a equipe. Para usar, entre no SEDES com a sua conta e depois volte a este endereço.</p><p><a class="botao" href="/pt/login">Entrar no SEDES</a></p>`;
  res.writeHead(a.situacao === "sem-permissao" ? 403 : 401, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Assistente de dados do SEDES</title><link rel="icon" href="favicon.svg"><link rel="stylesheet" href="estilo.css"></head><body><main class="acesso"><img src="logo.svg" alt="SEDES" width="136" height="46"><h1>Assistente de dados</h1>${corpo}</main></body></html>`,
  );
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

function notasPorTurno(regs: Registro[]) {
  const notas = new Map<number, { nota: string | null; comentario: string }>();
  for (const r of regs)
    if (r.tipo === "avaliacao")
      notas.set(r.turno, { nota: r.nota, comentario: r.comentario ?? "" });
  return notas;
}

function listarConversas(email: string | undefined) {
  return readdirSync(CONVERSAS)
    .filter((f) => f.endsWith(".jsonl"))
    .sort()
    .reverse()
    .flatMap((f) => {
      const regs = lerRegistros(path.join(CONVERSAS, f));
      const inicio = inicioDe(regs);
      if (!dono(email, inicio?.email)) return [];
      const turnos = turnosDe(regs);
      if (!turnos.length) return [];
      const notas = notasPorTurno(regs);
      return [
        {
          id: inicio?.id ?? f.replace(/^.*_|\.jsonl$/g, ""),
          modelo: inicio?.modelo,
          em: inicio?.em,
          titulo: turnos[0]?.pergunta?.slice(0, 120) ?? "",
          turnos: turnos.length,
          bons: [...notas.values()].filter((n) => n.nota === "bom").length,
          ruins: [...notas.values()].filter((n) => n.nota === "ruim").length,
        },
      ];
    });
}

const servidor = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://chat");

    // Para o deploy saber que subiu; não precisa de login.
    if (req.method === "GET" && url.pathname === "/api/saude") {
      json(res, 200, { ok: true, motor: motor.nome, tabelao: GERADO_EM });
      return;
    }

    const livres = ["/estilo.css", "/logo.svg", "/favicon.svg"];
    if (req.method === "GET" && livres.includes(url.pathname)) {
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
      // consegue gastar perguntas mandando pedidos para cá.
      const origem = req.headers.origin;
      if (origem && !ORIGENS.has(origem)) {
        json(res, 403, { erro: "origem não permitida" });
        return;
      }
    }

    const a = await acesso.verificar(req.headers.cookie);
    if (a.situacao !== "liberado") {
      if (url.pathname.startsWith("/api/"))
        json(res, a.situacao === "sem-login" ? 401 : 403, {
          erro:
            a.situacao === "sem-login"
              ? "entre no SEDES para usar o assistente"
              : "esta conta não tem acesso ao assistente",
        });
      else paginaDeAcesso(res, a);
      return;
    }
    const email = a.email;

    if (req.method === "GET" && ESTATICOS[url.pathname]) {
      const arquivo = ESTATICOS[url.pathname];
      res.writeHead(200, {
        "content-type": TIPOS[path.extname(arquivo)] ?? TIPOS[".html"],
        "cache-control": "no-cache",
      });
      res.end(readFileSync(arquivo));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/info") {
      json(res, 200, {
        tabelaoGeradoEm: GERADO_EM,
        motor: motor.nome,
        modelos: MODELOS,
        usuario: email ?? null,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/conversas") {
      json(res, 200, listarConversas(email));
      return;
    }

    const m = url.pathname.match(/^\/api\/conversas\/([a-z0-9-]+)$/);
    if (req.method === "GET" && m) {
      const arquivo = arquivoDaConversa(m[1]);
      const regs = arquivo ? lerRegistros(arquivo) : [];
      if (!arquivo || !dono(email, inicioDe(regs)?.email))
        return json(res, 404, { erro: "conversa não encontrada" });
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
      const recusa = limites.recusa(email);
      if (recusa) return json(res, 429, { erro: recusa });
      const modelo = MODELOS.includes(String(corpo.modelo))
        ? String(corpo.modelo)
        : MODELOS[0];
      const c = corpo.conversa
        ? obterConversa(String(corpo.conversa), email)
        : novaConversa(modelo, email);
      if (!c) return json(res, 404, { erro: "conversa não encontrada" });
      if (c.turno)
        return json(res, 409, { erro: "a conversa ainda está respondendo" });
      if (c.turnos >= TURNOS_MAX)
        return json(res, 400, {
          erro: `esta conversa chegou a ${TURNOS_MAX} perguntas; comece uma nova`,
        });

      res.writeHead(200, {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-cache",
        // Sem isto o nginx guarda a resposta e ela chega de uma vez no fim.
        "x-accel-buffering": "no",
      });
      const enviar = (e: Evento) => {
        if (!res.writableEnded) res.write(JSON.stringify(e) + "\n");
      };
      c.turnos += 1;
      limites.contarPergunta(email);
      const turno = new Turno(c.turnos, texto, enviar, (t, fim) =>
        registrarFim(c, t, fim, enviar, () => res.end()),
      );
      c.turno = turno;
      enviar({ tipo: "conversa", id: c.id, modelo: c.modelo, turno: c.turnos });
      motor.responder({
        conversa: c.id,
        modelo: c.modelo,
        turno,
        contexto: { email, cookieSessao: a.cookieSessao },
        anteriores: () => {
          const regs = existsSync(c.arquivo) ? lerRegistros(c.arquivo) : [];
          return turnosDe(regs).filter((r) => r.turno < turno.numero);
        },
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/parar") {
      const corpo = await lerCorpo(req);
      const c = obterConversa(String(corpo.conversa), email);
      if (c?.turno) motor.parar(c.id);
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/avaliacao") {
      const corpo = await lerCorpo(req);
      const c = obterConversa(String(corpo.conversa), email);
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
    console.error(e);
    if (!res.headersSent) json(res, 500, { erro: "erro no servidor do chat" });
    else res.end();
  }
});

for (const sinal of ["SIGINT", "SIGTERM"] as const)
  process.on(sinal, () => {
    motor.encerrar();
    process.exit(0);
  });

servidor.listen(PORTA, HOST, () => {
  const endereco = LOCAL ? `http://localhost:${PORTA}` : `${HOST}:${PORTA}`;
  console.log(
    `Chat do SEDES em ${endereco} (motor ${motor.nome}, modelos ${MODELOS.join(", ")})`,
  );
  console.log(
    acesso.comLogin
      ? "Com login do SEDES (SEDES_CHAT_EMAILS)."
      : "Sem login: só para este computador.",
  );
  console.log(`Tabelão: ${TABELAO}`);
  console.log(`Conversas gravadas em ${CONVERSAS}`);
  const { porPessoa, tetoUsd } = limites;
  console.log(
    `Limites por dia: ${porPessoa || "sem limite de"} perguntas por pessoa, teto de US$ ${tetoUsd || "—"}.`,
  );
});
