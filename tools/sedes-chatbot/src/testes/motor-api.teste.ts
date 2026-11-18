/**
 * Testa o motor da API sem chave: uma API de mentira responde com roteiros
 * fixos no formato de streaming da Anthropic, e as ferramentas rodam de
 * verdade no tabelão. npm run testar
 */
import Anthropic from "@anthropic-ai/sdk";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";

process.env.SEDES_CHAT_RODADAS = "3";
// A revisão das frases é uma ida a mais ao modelo; ela tem teste próprio em
// acabamento.teste.ts.
process.env.SEDES_CHAT_REVISAR = "0";
const { criarMotorApi } = await import("../chat/motor-api.ts");
const { Turno } = await import("../chat/turno.ts");
const { encerrarFerramentas, FERRAMENTAS } = await import("../ferramentas.ts");

type Bloco =
  | { tipo: "texto"; texto: string }
  | { tipo: "ferramenta"; id: string; nome: string; entrada: unknown };
type Roteiro = { blocos: Bloco[]; espera?: number; status?: number };

const pedidos: Array<Record<string, unknown>> = [];
let roteiros: Roteiro[] = [];

function sse(res: http.ServerResponse, tipo: string, dados: unknown) {
  res.write(`event: ${tipo}\ndata: ${JSON.stringify(dados)}\n\n`);
}

const api = http.createServer(async (req, res) => {
  let corpo = "";
  for await (const p of req) corpo += p;
  pedidos.push(JSON.parse(corpo));
  const r = roteiros.shift();
  if (!r) throw new Error("pedido sem roteiro");
  if (r.status) {
    res.writeHead(r.status, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        type: "error",
        error: { type: "invalid_request_error", message: "roteiro de erro" },
      }),
    );
    return;
  }
  res.writeHead(200, { "content-type": "text/event-stream" });
  sse(res, "message_start", {
    type: "message_start",
    message: {
      id: `msg_${pedidos.length}`,
      type: "message",
      role: "assistant",
      model: "claude-haiku-5-5",
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 1000,
        output_tokens: 1,
        cache_read_input_tokens: 20_000,
        cache_creation_input_tokens: 0,
      },
    },
  });
  if (r.espera) await new Promise((ok) => setTimeout(ok, r.espera));
  r.blocos.forEach((b, i) => {
    if (b.tipo === "texto") {
      sse(res, "content_block_start", {
        type: "content_block_start",
        index: i,
        content_block: { type: "text", text: "" },
      });
      for (const pedaco of b.texto.match(/.{1,8}/g) ?? [])
        sse(res, "content_block_delta", {
          type: "content_block_delta",
          index: i,
          delta: { type: "text_delta", text: pedaco },
        });
    } else {
      sse(res, "content_block_start", {
        type: "content_block_start",
        index: i,
        content_block: { type: "tool_use", id: b.id, name: b.nome, input: {} },
      });
      sse(res, "content_block_delta", {
        type: "content_block_delta",
        index: i,
        delta: {
          type: "input_json_delta",
          partial_json: JSON.stringify(b.entrada),
        },
      });
    }
    sse(res, "content_block_stop", { type: "content_block_stop", index: i });
  });
  const usaFerramenta = r.blocos.some((b) => b.tipo === "ferramenta");
  sse(res, "message_delta", {
    type: "message_delta",
    delta: {
      stop_reason: usaFerramenta ? "tool_use" : "end_turn",
      stop_sequence: null,
    },
    usage: { output_tokens: 200 },
  });
  sse(res, "message_stop", { type: "message_stop" });
  res.end();
});

let cliente: Anthropic;
before(async () => {
  await new Promise<void>((ok) => api.listen(0, "127.0.0.1", ok));
  const { port } = api.address() as AddressInfo;
  cliente = new Anthropic({
    apiKey: "chave-de-teste",
    baseURL: `http://127.0.0.1:${port}`,
    maxRetries: 0,
  });
});
after(() => {
  api.close();
  encerrarFerramentas();
});

/** Roda uma pergunta e devolve os eventos que iriam para a página. */
function perguntar(
  motor: ReturnType<typeof criarMotorApi>,
  conversa: string,
  pergunta: string,
  numero = 1,
  aoComecar?: () => void,
) {
  const eventos: Array<Record<string, unknown>> = [];
  return new Promise<{
    eventos: typeof eventos;
    fim: Record<string, unknown>;
    resposta: string;
  }>((ok) => {
    const turno = new Turno(
      numero,
      pergunta,
      (e) => eventos.push(e),
      (t, fim) => ok({ eventos, fim, resposta: t.resposta }),
    );
    motor.responder({
      conversa,
      modelo: "haiku",
      turno,
      contexto: {},
      anteriores: () => [],
    });
    aoComecar?.();
  });
}

test("consulta o tabelão, devolve as duas ferramentas juntas e escreve a resposta", async () => {
  pedidos.length = 0;
  roteiros = [
    {
      blocos: [
        {
          tipo: "ferramenta",
          id: "tu_1",
          nome: "consultar_sql",
          entrada: {
            sql: "SELECT nome AS rotulo, 1.5 AS valor FROM territorios WHERE codigo='2504009' AND 'monitor-de-seca-ana' <> ''",
          },
        },
        {
          tipo: "ferramenta",
          id: "tu_2",
          nome: "buscar_territorio",
          entrada: { nome: "Campina Grande", uf: "PB" },
        },
      ],
    },
    {
      blocos: [
        {
          tipo: "texto",
          texto:
            "Campina Grande tem 1,5.\n\n» E em Patos, na Paraíba?\n» Como isso mudou desde 2024?",
        },
      ],
    },
  ];
  const motor = criarMotorApi({ cliente });
  const { eventos, fim, resposta } = await perguntar(
    motor,
    "c1",
    "Qual o valor?",
  );

  assert.equal(resposta, "Campina Grande tem 1,5.");
  assert.equal(fim.erro, null);
  assert.equal(fim.interrompida, false);
  assert.ok(Number(fim.custo_usd) > 0);
  const saidas = eventos.filter((e) => e.tipo === "saida");
  assert.equal(saidas.length, 2);
  const saidaDe = (id: string) =>
    String(saidas.find((e) => e.id === id)?.texto);
  assert.match(saidaDe("tu_1"), /Campina Grande/);
  assert.match(saidaDe("tu_2"), /2504009/);
  // O link do site é montado pela página, a partir da consulta.
  const link = eventos.find((e) => e.tipo === "link");
  assert.match(String(link?.url), /locationKey=2504009.*monitor-de-seca-ana/);
  // As perguntas sugeridas saem do texto e chegam como botões.
  assert.deepEqual(eventos.find((e) => e.tipo === "sugestoes")?.perguntas, [
    "E em Patos, na Paraíba?",
    "Como isso mudou desde 2024?",
  ]);
  assert.ok(
    !eventos.some((e) => e.tipo === "texto" && String(e.t).includes("»")),
  );

  // O segundo pedido leva os dois resultados numa mensagem só, e o prompt,
  // as ferramentas e o cache vão em todo pedido.
  const segundo = pedidos[1] as {
    messages: Array<{ role: string; content: Array<{ type: string }> }>;
    tools: unknown[];
    system: Array<{ cache_control?: unknown }>;
    cache_control?: unknown;
  };
  const ultima = segundo.messages.at(-1)!;
  assert.equal(ultima.role, "user");
  assert.deepEqual(
    ultima.content.map((b) => b.type),
    ["tool_result", "tool_result"],
  );
  assert.equal(segundo.tools.length, FERRAMENTAS.length);
  assert.ok(segundo.system[0].cache_control);
  assert.ok(segundo.cache_control);
});

test("entrada inválida volta ao modelo como erro, sem rodar a ferramenta", async () => {
  pedidos.length = 0;
  roteiros = [
    {
      blocos: [
        {
          tipo: "ferramenta",
          id: "tu_x",
          nome: "consultar_sql",
          entrada: { sql: 42 },
        },
      ],
    },
    { blocos: [{ tipo: "texto", texto: "ok" }] },
  ];
  const motor = criarMotorApi({ cliente });
  const { eventos } = await perguntar(motor, "c2", "teste");
  const saida = eventos.find((e) => e.tipo === "saida")!;
  assert.equal(saida.erro, true);
  const resultado = (
    pedidos[1] as {
      messages: Array<{ content: Array<{ is_error?: boolean }> }>;
    }
  ).messages.at(-1)!.content[0];
  assert.equal(resultado.is_error, true);
});

test("na última rodada o modelo não pode mais chamar ferramenta", async () => {
  pedidos.length = 0;
  const ferramenta: Roteiro = {
    blocos: [
      { tipo: "ferramenta", id: "tu_l", nome: "listar_indices", entrada: {} },
    ],
  };
  roteiros = [
    ferramenta,
    ferramenta,
    { blocos: [{ tipo: "texto", texto: "fim" }] },
  ];
  const motor = criarMotorApi({ cliente });
  const { resposta } = await perguntar(motor, "c3", "teste");
  assert.equal(resposta, "fim");
  const escolhas = pedidos.map((p) => (p.tool_choice as { type: string }).type);
  assert.deepEqual(escolhas, ["auto", "auto", "none"]);
});

test("Parar interrompe, e a pergunta seguinte segue com o histórico em ordem", async () => {
  pedidos.length = 0;
  roteiros = [
    { espera: 2_000, blocos: [{ tipo: "texto", texto: "nunca chega" }] },
    { blocos: [{ tipo: "texto", texto: "segunda" }] },
  ];
  const motor = criarMotorApi({ cliente });
  const primeira = await perguntar(motor, "c4", "primeira", 1, () =>
    setTimeout(() => motor.parar("c4"), 200),
  );
  assert.equal(primeira.fim.interrompida, true);
  assert.equal(primeira.fim.erro, null);

  const segunda = await perguntar(motor, "c4", "segunda pergunta", 2);
  assert.equal(segunda.resposta, "segunda");
  const papeis = (
    pedidos[1] as { messages: Array<{ role: string }> }
  ).messages.map((m) => m.role);
  assert.deepEqual(papeis, ["user", "assistant", "user"]);
});

test("erro da API vira mensagem para a pessoa e não quebra a conversa", async () => {
  pedidos.length = 0;
  roteiros = [
    { status: 400, blocos: [] },
    { blocos: [{ tipo: "texto", texto: "voltou" }] },
  ];
  const motor = criarMotorApi({ cliente });
  const primeira = await perguntar(motor, "c5", "primeira");
  assert.match(String(primeira.fim.erro), /erro 400/);
  const segunda = await perguntar(motor, "c5", "de novo", 2);
  assert.equal(segunda.resposta, "voltou");
});

test("servidor da página: responde em NDJSON, grava a conversa e respeita o teto do dia", async () => {
  const { spawn } = await import("node:child_process");
  const { mkdtempSync, readdirSync, readFileSync, rmSync } =
    await import("node:fs");
  const { tmpdir } = await import("node:os");
  const pasta = mkdtempSync(`${tmpdir()}/chat-teste-`);
  const { port } = api.address() as AddressInfo;
  const porta = 3290 + Math.floor(Math.random() * 100);
  const servidor = spawn(
    process.execPath,
    ["--import", "tsx", "src/chat/servidor-chat.ts"],
    {
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: "chave-de-teste",
        ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`,
        SEDES_CHAT_PORTA: String(porta),
        SEDES_CHAT_CONVERSAS: pasta,
        SEDES_CHAT_MODELOS: "haiku",
        // Uma pergunta do roteiro custa ~US$ 0,0004: a segunda já passa do teto.
        SEDES_CHAT_TETO_DIARIO_USD: "0.0001",
      },
      stdio: "ignore",
    },
  );
  try {
    const base = `http://127.0.0.1:${porta}`;
    for (let i = 0; i < 60; i++) {
      if (
        await fetch(`${base}/api/saude`).then(
          (r) => r.ok,
          () => false,
        )
      )
        break;
      await new Promise((ok) => setTimeout(ok, 250));
    }
    pedidos.length = 0;
    roteiros = [{ blocos: [{ tipo: "texto", texto: "Olá do roteiro." }] }];
    const perguntar = () =>
      fetch(`${base}/api/mensagem`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: base },
        body: JSON.stringify({ texto: "oi", modelo: "sonnet" }),
      });
    const r = await perguntar();
    assert.equal(r.status, 200);
    const eventos = (await r.text())
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    assert.equal(eventos[0].tipo, "conversa");
    // Pediu Sonnet, mas o servidor só oferece Haiku.
    assert.equal(eventos[0].modelo, "haiku");
    assert.equal(eventos.at(-1).tipo, "fim");
    assert.equal(
      eventos
        .filter((e) => e.tipo === "texto")
        .map((e) => e.t)
        .join(""),
      "Olá do roteiro.",
    );

    const [arquivo] = readdirSync(pasta);
    const registros = readFileSync(`${pasta}/${arquivo}`, "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    assert.deepEqual(
      registros.map((x) => x.tipo),
      ["inicio", "turno"],
    );
    assert.equal(registros[0].motor, "api");
    assert.ok(registros[1].custo_usd > 0);

    const segunda = await perguntar();
    assert.equal(segunda.status, 429);
    assert.equal(pedidos.length, 1);
  } finally {
    servidor.kill();
    rmSync(pasta, { recursive: true, force: true });
  }
});
