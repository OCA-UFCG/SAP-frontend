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
    const allMetrics = includeTotal
      ? [
          ...metrics,
          {
            name: "total",
            durationMs: performance.now() - startedAt,
            description: "Tempo total no servidor",
          },
        ]
      : metrics;

    return allMetrics
      .map(({ name, durationMs, description }) => {
        const safeName = name.replace(/[^a-zA-Z0-9_-]/gu, "_");
        const safeDescription = description
          ? toHeaderSafeDescription(description)
          : undefined;
        return `${safeName};dur=${durationMs.toFixed(1)}${
          safeDescription ? `;desc="${safeDescription}"` : ""
        }`;
      })
      .join(", ");
  }

  return { record, start, header };
}
