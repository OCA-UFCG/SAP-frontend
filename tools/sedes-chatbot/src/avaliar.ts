/**
 * Avalia o bot com as perguntas de perguntas.md, pelo mesmo motor da página de
 * chat. Cada pergunta é uma conversa (as linhas "Depois:" continuam a mesma
 * conversa). Para cada resposta, grava tempo, rodadas, ferramentas e tokens,
 * confere os números esperados e pede a nota a um juiz (Sonnet, pelo claude).
 *
 * O motor "claude" (padrão) e o juiz gastam a assinatura de quem roda; o motor
 * "api" gasta a chave (ANTHROPIC_API_KEY).
 *
 * Uso:
 *   npm run avaliar                               # todas, Haiku
 *   npm run avaliar -- --modelo sonnet
 *   npm run avaliar -- --so M01,E02               # só algumas
 *   npm run avaliar -- --categoria M,E            # pelas letras do id
 *   npm run avaliar -- --rotulo antes             # nome da rodada
 *   npm run avaliar -- --motor api --sem-juiz
 *   npm run avaliar -- --juizar antes             # só refaz as notas de uma rodada
 *   npm run avaliar -- --comparar antes depois    # compara duas rodadas
 *
 * Grava resultados/brutos/<rotulo>/<id>.json (fora do git) e o resumo em
 * resultados/rodadas/<rotulo>.md.
 */
import { execFile } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  lerPerguntas,
  numerosFaltando,
  PACOTE,
  type Pergunta,
} from "./avaliacao.ts";
import { Turno, type FimDoTurno, type Motor } from "./chat/turno.ts";
import {
  catalogoResumido,
  encerrarFerramentas,
  textosDoSite,
} from "./ferramentas.ts";

const { values: opc, positionals } = parseArgs({
  options: {
    modelo: { type: "string", default: "haiku" },
    motor: { type: "string", default: "claude" },
    so: { type: "string" },
    categoria: { type: "string" },
    rotulo: { type: "string" },
    paralelo: { type: "string", default: "3" },
    "sem-juiz": { type: "boolean", default: false },
    juiz: { type: "string", default: "claude-sonnet-5-5" },
    juizar: { type: "string" },
    comparar: { type: "boolean", default: false },
  },
  allowPositionals: true,
});

const BRUTOS = path.join(PACOTE, "resultados/brutos");
const RODADAS = path.join(PACOTE, "resultados/rodadas");

// --- o que se grava de cada pergunta -----------------------------------------

type Tokens = {
  entrada: number;
  cache_leitura: number;
  cache_escrita: number;
  saida: number;
};

type TurnoGravado = {
  pergunta: string;
  resposta: string;
  ferramentas: Array<{
    nome: string;
    entrada: unknown;
    saida?: string;
    erro?: boolean;
    ms?: number;
  }>;
  ms: number;
  rodadas: number | null;
  tokens: Tokens;
  custo_usd: number | null;
  erro: string | null;
};

type Nota = "certo" | "parcial" | "errado";

type Resultado = {
  id: string;
  categoria: string;
  modelo: string;
  motor: string;
  em: string;
  esperada: string;
  turnos: TurnoGravado[];
  numeros_faltando: string[];
  juiz?: { nota: Nota; motivo: string; modelo: string };
};

/** Junta o uso dos dois motores (claude: usage da API; api: o nosso Uso). */
function tokensDe(uso: unknown): { tokens: Tokens; rodadas: number | null } {
  const u = (uso ?? {}) as Record<string, number | undefined>;
  return {
    tokens: {
      entrada: u.input_tokens ?? u.entrada ?? 0,
      cache_leitura: u.cache_read_input_tokens ?? u.cache_leitura ?? 0,
      cache_escrita: u.cache_creation_input_tokens ?? u.cache_escrita ?? 0,
      saida: u.output_tokens ?? u.saida ?? 0,
    },
    rodadas: u.rodadas ?? null,
  };
}

// --- rodar as perguntas -------------------------------------------------------

async function criarMotor(): Promise<Motor> {
  if (opc.motor === "api") {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_BASE_URL)
      throw new Error("O motor api precisa de ANTHROPIC_API_KEY.");
    return (await import("./chat/motor-api.ts")).criarMotorApi();
  }
  // Pasta própria: não troca o mcp.json da página de chat que esteja aberta.
  process.env.SEDES_SESSAO ??= path.join(
    os.homedir(),
    ".cache/sedes-chatbot-avaliacao",
  );
  // Sem processo de reserva: cada pergunta abre o seu, como nas rodadas antigas.
  return (await import("./chat/motor-claude.ts")).criarMotorClaude({
    argsExtras: ["--no-session-persistence"],
    reserva: false,
  });
}

function perguntar(
  motor: Motor,
  conversa: string,
  numero: number,
  pergunta: string,
  anteriores: TurnoGravado[],
) {
  return new Promise<{ turno: Turno; fim: FimDoTurno }>((ok) => {
    const turno = new Turno(
      numero,
      pergunta,
      () => {},
      (t, fim) => ok({ turno: t, fim }),
    );
    motor.responder({
      conversa,
      modelo: opc.modelo!,
      turno,
      contexto: {},
      anteriores: () => anteriores,
    });
  });
}

async function rodarPergunta(motor: Motor, p: Pergunta): Promise<Resultado> {
  const conversa = `avaliacao-${p.id}-${Date.now()}`;
  const turnos: TurnoGravado[] = [];
  try {
    for (const [i, pergunta] of p.perguntas.entries()) {
      const { turno, fim } = await perguntar(
        motor,
        conversa,
        i + 1,
        pergunta,
        turnos,
      );
      const { tokens, rodadas } = tokensDe(fim.uso);
      turnos.push({
        pergunta,
        resposta: turno.resposta,
        ferramentas: turno.ferramentas.map((f) => ({
          nome: f.nome,
          entrada: f.entrada,
          saida: f.saida,
          erro: f.erro,
          ms: f.ms,
        })),
        ms: Date.now() - turno.inicio,
        rodadas,
        tokens,
        custo_usd: fim.custo_usd ?? null,
        erro: fim.erro ?? (fim.interrompida ? "interrompida" : null),
      });
      if (fim.erro) break;
    }
  } finally {
    motor.esquecer(conversa);
  }
  return {
    id: p.id,
    categoria: p.categoria,
    modelo: opc.modelo!,
    motor: motor.nome,
    em: new Date().toISOString(),
    esperada: p.esperada,
    turnos,
    numeros_faltando: numerosFaltando(turnos.at(-1)?.resposta ?? "", p.numeros),
  };
}

/** Roda fn em cada item, com no máximo n ao mesmo tempo. */
async function emParalelo<T>(
  itens: T[],
  n: number,
  fn: (x: T) => Promise<void>,
) {
  const fila = [...itens];
  await Promise.all(
    Array.from({ length: Math.min(n, fila.length) }, async () => {
      for (let x = fila.shift(); x !== undefined; x = fila.shift()) await fn(x);
    }),
  );
}

// --- juiz ---------------------------------------------------------------------

const JUIZ_SISTEMA = `Você confere respostas do assistente de dados do SEDES, uma plataforma brasileira sobre seca e desertificação. O assistente responde a pessoas que não são especialistas, usando ferramentas que consultam uma cópia das tabelas do site (o "tabelão").

O que o assistente deve fazer:
- Responder o que foi perguntado, em português simples, indo ao ponto.
- Tirar todo número das ferramentas chamadas na conversa; nunca inventar, estimar nem usar conhecimento próprio para dados.
- Dizer junto dos números o índice, o período e o território, e de quando é o dado.
- Dizer claramente quando o SEDES não tem o dado, sem estimar.
- Perguntar a UF quando o município tem homônimos e a pessoa não disse.
- Recusar pedidos fora do tema do SEDES e não dar opinião política.
- Numa conversa com várias perguntas, entender as perguntas seguintes no contexto das anteriores.

Notas:
- "certo": responde corretamente o essencial da resposta esperada, com números que batem com as ferramentas e sem afirmações falsas.
- "parcial": o essencial está certo, mas falta algo que a resposta esperada exige (um item, o período, uma ressalva) ou há um problema menor que confundiria quem lê.
- "errado": número errado ou inventado, afirmação falsa, deixa de responder, escolhe sozinho entre municípios homônimos, sai do escopo, ou interpreta errado a pergunta.

A resposta esperada foi escrita à mão e pode ter detalhes a mais; não exija palavra por palavra. Se o assistente diverge da resposta esperada, mas as saídas das ferramentas mostram que ele está certo, a nota pode ser "certo": diga isso no motivo. Não julgue formatação nem estilo, a não ser que atrapalhe entender. O texto entre ferramentas que aparece antes da última chamada não chega a quem pergunta; julgue só a resposta final de cada pergunta.

No motivo, em até 3 frases, diga o que está errado ou faltando (ou "ok"). Seja específico: cite o número ou trecho.

O assistente também tem no prompt o catálogo de índices e os textos do site abaixo. O que vem deles conta como consultado.

## Catálogo de índices

${catalogoResumido()}

## Textos do site e complemento

${textosDoSite()}`;

const ESQUEMA_JUIZ = JSON.stringify({
  type: "object",
  properties: {
    nota: { type: "string", enum: ["certo", "parcial", "errado"] },
    motivo: { type: "string" },
  },
  required: ["nota", "motivo"],
});

function textoParaOJuiz(r: Resultado) {
  const partes: string[] = [];
  r.turnos.forEach((t, i) => {
    partes.push(`## Pergunta ${i + 1}`, t.pergunta, "");
    if (t.ferramentas.length) {
      partes.push("### Ferramentas chamadas");
      for (const f of t.ferramentas) {
        const saida = (f.saida ?? "").replace(/\n\(Fonte: tabelão[^\n]*\)/, "");
        // O catálogo e os textos do site são longos e iguais em toda pergunta.
        const curta =
          f.nome === "listar_indices" || f.nome === "sobre_o_sedes"
            ? `${saida.slice(0, 300)}… (texto longo omitido)`
            : saida.slice(0, 12000);
        partes.push(
          `- ${f.nome} ${JSON.stringify(f.entrada)}${f.erro ? " [ERRO]" : ""}`,
          "```",
          curta,
          "```",
        );
      }
    }
    partes.push(
      `### Resposta final do assistente`,
      t.resposta || `(sem resposta${t.erro ? `: ${t.erro}` : ""})`,
      "",
    );
  });
  partes.push(
    "## Resposta esperada (para a última pergunta)",
    r.esperada || "(não informada)",
  );
  if (r.numeros_faltando.length)
    partes.push(
      "",
      `Atenção: estes números esperados não aparecem na última resposta: ${r.numeros_faltando.join(", ")}.`,
    );
  return partes.join("\n");
}

function julgar(r: Resultado): Promise<Resultado["juiz"]> {
  const pasta = path.join(os.homedir(), ".cache/sedes-chatbot-juiz");
  mkdirSync(pasta, { recursive: true });
  return new Promise((ok) => {
    const proc = execFile(
      "claude",
      [
        "-p",
        "--model",
        opc.juiz!,
        "--tools",
        "",
        "--setting-sources",
        "",
        "--disable-slash-commands",
        "--no-session-persistence",
        "--system-prompt",
        JUIZ_SISTEMA,
        "--output-format",
        "json",
        "--json-schema",
        ESQUEMA_JUIZ,
      ],
      { cwd: pasta, maxBuffer: 10_000_000, timeout: 180_000 },
      (erro, stdout) => {
        try {
          const j = JSON.parse(stdout) as {
            structured_output?: { nota: Nota; motivo: string };
          };
          if (!j.structured_output) throw new Error("sem structured_output");
          ok({ ...j.structured_output, modelo: opc.juiz! });
        } catch (e) {
          console.error(`[juiz] ${r.id}: ${erro?.message ?? e}`);
          ok(undefined);
        }
      },
    );
    proc.stdin!.end(textoParaOJuiz(r));
  });
}

// --- resumo -------------------------------------------------------------------

const media = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
const quantil = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN;
};
const um = (x: number) =>
  Number.isNaN(x) ? "?" : x.toFixed(1).replace(".", ",");
const mil = (x: number) =>
  Number.isNaN(x)
    ? "?"
    : `${Math.round(x / 100) / 10}`.replace(".", ",") + " mil";
const entradaTotal = (t: Tokens) =>
  t.entrada + t.cache_leitura + t.cache_escrita;

function lerRodada(rotulo: string): Resultado[] {
  const dir = path.join(BRUTOS, rotulo);
  if (!existsSync(dir)) throw new Error(`Rodada não encontrada: ${dir}`);
  const ordem = new Map(lerPerguntas().map((p, i) => [p.id, i]));
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map(
      (f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")) as Resultado,
    )
    .sort((a, b) => (ordem.get(a.id) ?? 999) - (ordem.get(b.id) ?? 999));
}

function metricas(rs: Resultado[]) {
  const turnos = rs.flatMap((r) => r.turnos);
  const notas = rs.map((r) => r.juiz?.nota);
  return {
    perguntas: rs.length,
    turnos: turnos.length,
    certo: notas.filter((n) => n === "certo").length,
    parcial: notas.filter((n) => n === "parcial").length,
    errado: notas.filter((n) => n === "errado").length,
    sem_nota: notas.filter((n) => !n).length,
    numeros_faltando: rs.filter((r) => r.numeros_faltando.length).length,
    erros: turnos.filter((t) => t.erro).length,
    s_media: media(turnos.map((t) => t.ms / 1000)),
    s_mediana: quantil(
      turnos.map((t) => t.ms / 1000),
      0.5,
    ),
    s_p90: quantil(
      turnos.map((t) => t.ms / 1000),
      0.9,
    ),
    rodadas: media(turnos.flatMap((t) => (t.rodadas ? [t.rodadas] : []))),
    ferramentas: media(turnos.map((t) => t.ferramentas.length)),
    listar_indices:
      turnos.filter((t) =>
        t.ferramentas.some((f) => f.nome === "listar_indices"),
      ).length / (turnos.length || 1),
    tokens_entrada: media(turnos.map((t) => entradaTotal(t.tokens))),
    tokens_saida: media(turnos.map((t) => t.tokens.saida)),
    custo: turnos.reduce((a, t) => a + (t.custo_usd ?? 0), 0),
  };
}

function linhaMetricas(m: ReturnType<typeof metricas>) {
  return [
    `| Perguntas (turnos) | ${m.perguntas} (${m.turnos}) |`,
    `| Notas do juiz | ${m.certo} certo · ${m.parcial} parcial · ${m.errado} errado${m.sem_nota ? ` · ${m.sem_nota} sem nota` : ""} |`,
    `| Com número esperado faltando | ${m.numeros_faltando} |`,
    `| Turnos com erro | ${m.erros} |`,
    `| Tempo por turno (média · mediana · p90) | ${um(m.s_media)} · ${um(m.s_mediana)} · ${um(m.s_p90)} s |`,
    `| Rodadas do modelo por turno | ${um(m.rodadas)} |`,
    `| Ferramentas por turno | ${um(m.ferramentas)} |`,
    `| Turnos que chamaram listar_indices | ${Math.round(m.listar_indices * 100)}% |`,
    `| Tokens de entrada por turno (com cache) | ${mil(m.tokens_entrada)} |`,
    `| Tokens de saída por turno | ${Math.round(m.tokens_saida)} |`,
    `| Custo somado (preço de API) | US$ ${m.custo.toFixed(2)} |`,
  ];
}

function resumir(rotulo: string) {
  const rs = lerRodada(rotulo);
  const m = metricas(rs);
  const ordemNota = { errado: 0, parcial: 1, undefined: 2, certo: 3 };
  const detalhes = [...rs]
    .sort(
      (a, b) =>
        ordemNota[String(a.juiz?.nota) as keyof typeof ordemNota] -
        ordemNota[String(b.juiz?.nota) as keyof typeof ordemNota],
    )
    .flatMap((r) => [
      `## ${r.id} — ${r.categoria} — ${r.juiz?.nota ?? "sem nota"}`,
      "",
      ...(r.juiz ? [`**Juiz:** ${r.juiz.motivo}`, ""] : []),
      ...(r.numeros_faltando.length
        ? [`**Números faltando:** ${r.numeros_faltando.join(", ")}`, ""]
        : []),
      `**Esperado:** ${r.esperada}`,
      "",
      ...r.turnos.flatMap((t) => [
        `**Pergunta:** ${t.pergunta}`,
        "",
        `${um(t.ms / 1000)} s · ${t.rodadas ?? "?"} rodadas · ${mil(entradaTotal(t.tokens))} tokens de entrada${t.erro ? ` · erro: ${t.erro}` : ""}`,
        "",
        ...t.ferramentas.map(
          (f) =>
            `1. ${f.nome}${f.erro ? " (erro)" : ""}: \`${JSON.stringify(f.entrada).replace(/`/g, "'").slice(0, 400)}\``,
        ),
        "",
        ...t.resposta.split("\n").map((l) => `> ${l}`),
        "",
      ]),
    ]);
  const md = [
    `# Rodada ${rotulo}`,
    "",
    `Modelo ${rs[0]?.modelo ?? "?"}, motor ${rs[0]?.motor ?? "?"}, juiz ${rs.find((r) => r.juiz)?.juiz?.modelo ?? "nenhum"}. Gerado por \`npm run avaliar\` em ${new Date().toISOString().slice(0, 16)}.`,
    "",
    "| Medida | Valor |",
    "| --- | --- |",
    ...linhaMetricas(m),
    "",
    "| Id | Categoria | Nota | Tempo (s) | Rodadas | Ferramentas |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rs.map(
      (r) =>
        `| ${r.id} | ${r.categoria} | ${r.juiz?.nota ?? "?"}${r.numeros_faltando.length ? " (nº)" : ""} | ${r.turnos.map((t) => um(t.ms / 1000)).join(" + ")} | ${r.turnos.map((t) => t.rodadas ?? "?").join(" + ")} | ${r.turnos.map((t) => t.ferramentas.length).join(" + ")} |`,
    ),
    "",
    ...detalhes,
  ].join("\n");
  mkdirSync(RODADAS, { recursive: true });
  const saida = path.join(RODADAS, `${rotulo}.md`);
  writeFileSync(saida, md);
  console.log(linhaMetricas(m).join("\n"));
  console.log(`Gravado ${path.relative(process.cwd(), saida)}`);
}

function comparar(a: string, b: string) {
  const ra = lerRodada(a);
  const rb = new Map(lerRodada(b).map((r) => [r.id, r]));
  const comuns = ra.filter((r) => rb.has(r.id));
  const ma = metricas(comuns);
  const mb = metricas(comuns.map((r) => rb.get(r.id)!));
  const la = linhaMetricas(ma);
  const lb = linhaMetricas(mb);
  console.log(`| Medida | ${a} | ${b} |\n| --- | --- | --- |`);
  la.forEach((l, i) => {
    const [, nome, va] = l.split("|").map((x) => x.trim());
    const vb = lb[i].split("|")[2].trim();
    console.log(`| ${nome} | ${va} | ${vb} |`);
  });
  console.log("\nMudanças de nota:");
  for (const r of comuns) {
    const na = r.juiz?.nota ?? "?";
    const nb = rb.get(r.id)!.juiz?.nota ?? "?";
    if (na !== nb)
      console.log(
        `  ${r.id}: ${na} → ${nb}  (${rb.get(r.id)!.juiz?.motivo ?? ""})`,
      );
  }
}

// --- principal ------------------------------------------------------------------

async function principal() {
  if (opc.comparar) {
    if (positionals.length !== 2) throw new Error("Uso: --comparar A B");
    comparar(positionals[0], positionals[1]);
    return;
  }
  if (opc.juizar) {
    const rs = lerRodada(opc.juizar);
    const filtro = opc.so?.split(",");
    await emParalelo(
      rs.filter((r) => !filtro || filtro.includes(r.id)),
      Number(opc.paralelo),
      async (r) => {
        r.juiz = await julgar(r);
        writeFileSync(
          path.join(BRUTOS, opc.juizar!, `${r.id}.json`),
          JSON.stringify(r, null, 1),
        );
        console.error(`${r.id}: ${r.juiz?.nota ?? "?"}`);
      },
    );
    resumir(opc.juizar);
    return;
  }

  const so = opc.so?.split(",");
  const categorias = opc.categoria?.split(",");
  const perguntas = lerPerguntas().filter(
    (p) =>
      (!so || so.includes(p.id)) &&
      (!categorias || categorias.some((c) => p.id.startsWith(c))),
  );
  if (!perguntas.length) throw new Error("Nenhuma pergunta selecionada.");
  const rotulo =
    opc.rotulo ??
    `${opc.modelo}-${opc.motor}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`;
  const dir = path.join(BRUTOS, rotulo);
  mkdirSync(dir, { recursive: true });
  const motor = await criarMotor();
  console.error(
    `Rodada ${rotulo}: ${perguntas.length} perguntas, ${opc.modelo} pelo motor ${motor.nome}.`,
  );
  let feitas = 0;
  try {
    await emParalelo(perguntas, Number(opc.paralelo), async (p) => {
      const r = await rodarPergunta(motor, p);
      if (!opc["sem-juiz"]) r.juiz = await julgar(r);
      writeFileSync(path.join(dir, `${p.id}.json`), JSON.stringify(r, null, 1));
      feitas += 1;
      console.error(
        `[${feitas}/${perguntas.length}] ${p.id} ${r.juiz?.nota ?? ""} ${r.turnos.map((t) => um(t.ms / 1000)).join("+")} s`,
      );
    });
  } finally {
    motor.encerrar();
    // No motor api as consultas rodam em processos filhos deste.
    encerrarFerramentas();
  }
  resumir(rotulo);
}

await principal();
