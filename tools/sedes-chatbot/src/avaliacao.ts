/**
 * Apoio do avaliar.sh.
 *   listar           imprime "ID<tab>pergunta" de cada pergunta de perguntas.md
 *   resumir <modelo> lê resultados/brutos/<modelo>/*.jsonl e escreve resultados/<modelo>.md
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACOTE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface Pergunta {
  id: string;
  categoria: string;
  pergunta: string;
  esperada: string;
}

function perguntas(): Pergunta[] {
  const md = readFileSync(path.join(PACOTE, "perguntas.md"), "utf8");
  return md
    .split(/^### /m)
    .slice(1)
    .map((bloco) => ({
      id: bloco.split(/\s/)[0],
      categoria: bloco.match(/^\S+ — ([^\n]+)/)?.[1] ?? "",
      pergunta: bloco.match(/\*\*Pergunta:\*\* ([^\n]+)/)?.[1] ?? "",
      esperada: bloco.match(/\*\*Resposta esperada:\*\* ([^\n]+)/)?.[1] ?? "",
    }));
}

interface Execucao {
  resposta: string;
  ferramentas: string[];
  segundos: number | null;
  turnos: number | null;
  erro: string | null;
}

/** O pedaço de cada linha do stream-json do claude -p que interessa aqui. */
interface EventoClaude {
  type: string;
  subtype?: string;
  message?: {
    content?: Array<{
      type: string;
      name?: string;
      input?: Record<string, unknown>;
    }>;
  };
  result?: string;
  num_turns?: number;
  is_error?: boolean;
  segundos?: number;
}

function lerExecucao(arquivo: string): Execucao {
  const ex: Execucao = {
    resposta: "",
    ferramentas: [],
    segundos: null,
    turnos: null,
    erro: null,
  };
  for (const linha of readFileSync(arquivo, "utf8").split("\n")) {
    if (!linha.trim().startsWith("{")) continue;
    let e: EventoClaude;
    try {
      e = JSON.parse(linha) as EventoClaude;
    } catch {
      continue;
    }
    if (e.type === "assistant") {
      for (const b of e.message?.content ?? []) {
        if (b.type === "tool_use") {
          const nome = String(b.name).replace(/^mcp__sedes__/, "");
          const arg =
            nome === "consultar_sql"
              ? String(b.input?.sql).replace(/\s+/g, " ").trim() +
                (b.input?.grafico
                  ? ` [gráfico: ${JSON.stringify(b.input.grafico)}]`
                  : "")
              : JSON.stringify(b.input);
          ex.ferramentas.push(`${nome}: ${arg}`);
        }
      }
    } else if (e.type === "result") {
      ex.resposta = e.result ?? "";
      ex.turnos = e.num_turns ?? null;
      if (e.is_error || e.subtype !== "success") ex.erro = e.subtype ?? "erro";
    } else if (e.type === "avaliar_tempo") {
      ex.segundos = e.segundos ?? null;
    }
  }
  return ex;
}

function resumir(modelo: string) {
  const dir = path.join(PACOTE, "resultados/brutos", modelo);
  const linhasTabela: string[] = [];
  const detalhes: string[] = [];
  for (const p of perguntas()) {
    const arquivo = path.join(dir, `${p.id}.jsonl`);
    if (!existsSync(arquivo)) continue;
    const ex = lerExecucao(arquivo);
    const nomes = ex.ferramentas.map((f) => f.split(":")[0]);
    const contagem = [...new Set(nomes)]
      .map((n) => `${n}×${nomes.filter((x) => x === n).length}`)
      .join(", ");
    linhasTabela.push(
      `| ${p.id} | ${p.categoria} | ${ex.segundos ?? "?"} | ${ex.turnos ?? "?"} | ${contagem || "nenhuma"} |${ex.erro ? ` ${ex.erro}` : ""}`,
    );
    detalhes.push(
      `## ${p.id} — ${p.categoria}`,
      "",
      `**Pergunta:** ${p.pergunta}`,
      "",
      `**Esperado:** ${p.esperada}`,
      "",
      `**Tempo:** ${ex.segundos ?? "?"} s · **turnos:** ${ex.turnos ?? "?"}${ex.erro ? ` · **erro:** ${ex.erro}` : ""}`,
      "",
      "**Ferramentas chamadas:**",
      "",
      ...(ex.ferramentas.length
        ? ex.ferramentas.map((f) => `1. \`${f.replace(/`/g, "'")}\``)
        : ["(nenhuma)"]),
      "",
      "**Resposta do bot:**",
      "",
      ...ex.resposta.split("\n").map((l) => `> ${l}`),
      "",
    );
  }
  const md = [
    `# Avaliação: ${modelo}`,
    "",
    `Gerado por avaliar.sh em ${new Date().toISOString()}.`,
    "",
    "| Id | Categoria | Tempo (s) | Turnos | Ferramentas |",
    "| --- | --- | --- | --- | --- |",
    ...linhasTabela,
    "",
    ...detalhes,
  ].join("\n");
  const saida = path.join(PACOTE, "resultados", `${modelo}.md`);
  writeFileSync(saida, md);
  console.error(`Gravado ${saida}`);
}

const [comando, arg] = process.argv.slice(2);
if (comando === "listar") {
  for (const p of perguntas()) console.log(`${p.id}\t${p.pergunta}`);
} else if (comando === "resumir" && arg) {
  resumir(arg);
} else {
  console.error("Uso: avaliacao.ts listar | resumir <modelo>");
  process.exit(1);
}
