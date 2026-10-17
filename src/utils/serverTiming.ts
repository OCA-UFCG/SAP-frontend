export type TimingObserver = (
  name: string,
  durationMs: number,
  description?: string,
) => void;

export interface ServerTimingMetric {
  name: string;
  durationMs: number;
  description?: string;
}

/**
 * Deixa a descrição transportável num cabeçalho HTTP.
 *
 * O valor de um cabeçalho viaja byte a byte, então só passa caractere de 0 a
 * 255: um travessão (U+2014), aspas curvas ou reticências fazem o
 * `new Response` lançar `Cannot convert argument to a ByteString`. Isso importa
 * porque a descrição carrega o **nome da camada**, texto livre escrito por quem
 * cadastra o índice no catálogo — e um relatório municipal inteiro já montado
 * era perdido por causa de um caractere no nome de um índice.
 *
 * O acento sai pelo mesmo motivo pelo qual já existia a limpeza de aspas: ele
 * cabe em um byte, mas o navegador lê o cabeçalho como Latin-1 e mostra
 * "PrevisÃ£o" no DevTools. Aqui a descrição é medição, não conteúdo, então
 * "Previsao" legível vale mais do que o acento correto.
 *
 * @example
 * toHeaderSafeDescription("Previsão: Anomalia — CPTEC"); // "Previsao: Anomalia CPTEC"
 */
function toHeaderSafeDescription(description: string) {
  return (
    description
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/gu, "")
      .replace(/[^\x20-\x7e]/gu, " ")
      // Aspas e barra invertida encerrariam a `quoted-string` do `desc=`.
      .replace(/["\\]/gu, " ")
      .replace(/\s+/gu, " ")
      .trim()
  );
}

/**
 * Teto do cabeçalho inteiro. O nginx da frente guarda os cabeçalhos da resposta
 * num buffer de 4 KB e, se eles não cabem, devolve 502 em vez da resposta. Cada
 * camada do Relatório Automático vira uma medição de ~120 bytes: com "Selecionar
 * todos" (39 camadas) num município ainda fora do cache, o cabeçalho passava de
 * 4,5 KB e o relatório já montado virava "Unexpected token '<'" na tela.
 */
const MAX_HEADER_LENGTH = 2048;

function formatMetric({ name, durationMs, description }: ServerTimingMetric) {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/gu, "_");
  const safeDescription = description
    ? toHeaderSafeDescription(description)
    : undefined;
  return `${safeName};dur=${durationMs.toFixed(1)}${
    safeDescription ? `;desc="${safeDescription}"` : ""
  }`;
}

/**
 * Quando as medições não cabem no teto, ficam as mais lentas — são elas que
 * explicam a demora —, na ordem em que aconteceram, e uma linha diz quantas
 * saíram. O `total` vem fora daqui e sempre aparece.
 */
function fitInHeader(entries: string[], metrics: ServerTimingMetric[]) {
  const budget = MAX_HEADER_LENGTH - 200;
  const length = (list: string[]) => list.join(", ").length;
  if (length(entries) <= budget) return entries;

  const kept = new Set<number>();
  let used = 0;
  for (const index of metrics
    .map((_, i) => i)
    .sort((a, b) => metrics[b].durationMs - metrics[a].durationMs)) {
    const size = entries[index].length + 2;
    if (used + size > budget) continue;
    kept.add(index);
    used += size;
  }

  const omitted = entries.length - kept.size;
  return [
    ...entries.filter((_, index) => kept.has(index)),
    formatMetric({
      name: "omitted",
      durationMs: 0,
      description: `${omitted} medicoes omitidas para caber no cabecalho`,
    }),
  ];
}

export function createServerTiming() {
  const metrics: ServerTimingMetric[] = [];
  const startedAt = performance.now();

  const record: TimingObserver = (name, durationMs, description) => {
    metrics.push({ name, durationMs, description });
  };

  function start() {
    const metricStartedAt = performance.now();
    return (name: string, description?: string) =>
      record(name, performance.now() - metricStartedAt, description);
  }

  function header(includeTotal = true) {
    const entries = metrics.map(formatMetric);
    const total = includeTotal
      ? formatMetric({
          name: "total",
          durationMs: performance.now() - startedAt,
          description: "Tempo total no servidor",
        })
      : undefined;

    return [...fitInHeader(entries, metrics), ...(total ? [total] : [])].join(
      ", ",
    );
  }

  return { record, start, header };
}
