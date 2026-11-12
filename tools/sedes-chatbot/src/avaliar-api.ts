/**
 * Roda as perguntas de perguntas.md pelo motor da API (o mesmo do beta) e
 * grava em resultados/<modelo>-api.md, no mesmo formato do avaliar.sh. Precisa
 * de ANTHROPIC_API_KEY e gasta a chave: ~US$ 0,17 no Haiku e ~US$ 2,60 no
 * Sonnet para as 48 perguntas (custos medidos no claude, fase das melhorias).
 *
 * Uso:
 *   npm run avaliar-api                        # haiku
 *   npm run avaliar-api -- sonnet
 *   PERGUNTAS="C01 P01" npm run avaliar-api    # só algumas
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarMotorApi, MODELOS } from "./chat/motor-api.ts";
import { Turno, type FimDoTurno } from "./chat/turno.ts";
import { encerrarFerramentas } from "./ferramentas.ts";

const PACOTE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apelido = process.argv[2] ?? "haiku";
const modelo = MODELOS[apelido];
if (!modelo) {
  console.error(`Modelo desconhecido: ${apelido} (use haiku ou sonnet).`);
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_BASE_URL) {
  console.error("Falta ANTHROPIC_API_KEY.");
  process.exit(1);
}

const lista = execFileSync(
  process.execPath,
  ["--import", "tsx", path.join(PACOTE, "src/avaliacao.ts"), "listar"],
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .map((l) => l.split("\t") as [string, string]);
const filtro = process.env.PERGUNTAS?.split(/\s+/).filter(Boolean);
const nome = `${modelo}-api`;
const brutos = path.join(PACOTE, "resultados/brutos", nome);
mkdirSync(brutos, { recursive: true });

const motor = criarMotorApi();
let total = 0;
for (const [id, pergunta] of lista) {
  if (filtro && !filtro.includes(id)) continue;
  console.error(`[${nome}] ${id}: ${pergunta}`);
  const { turno, fim } = await new Promise<{ turno: Turno; fim: FimDoTurno }>(
    (ok) => {
      const t = new Turno(
        1,
        pergunta,
        () => {},
        (turno, fim) => ok({ turno, fim }),
      );
      motor.responder({
        conversa: `avaliacao-${id}`,
        modelo: apelido,
        turno: t,
        contexto: {},
        anteriores: () => [],
      });
    },
  );
  total += fim.custo_usd ?? 0;
  // As mesmas linhas que o avaliacao.ts lê do stream-json do claude.
  const linhas = [
    {
      type: "assistant",
      message: {
        content: turno.ferramentas.map((f) => ({
          type: "tool_use",
          name: f.nome,
          input: f.entrada,
        })),
      },
    },
    {
      type: "result",
      subtype: fim.erro ? "error" : "success",
      is_error: Boolean(fim.erro),
      result: turno.resposta || fim.erro || "",
      num_turns: (fim.uso as { rodadas?: number } | undefined)?.rodadas ?? null,
      total_cost_usd: fim.custo_usd,
      usage: fim.uso,
    },
    { type: "avaliar_tempo", segundos: Math.round((fim.ms ?? 0) / 100) / 10 },
  ];
  writeFileSync(
    path.join(brutos, `${id}.jsonl`),
    linhas.map((l) => JSON.stringify(l)).join("\n") + "\n",
  );
}
encerrarFerramentas();
console.error(`Custo total: US$ ${total.toFixed(4)}`);
execFileSync(
  process.execPath,
  ["--import", "tsx", path.join(PACOTE, "src/avaliacao.ts"), "resumir", nome],
  { stdio: "inherit" },
);
