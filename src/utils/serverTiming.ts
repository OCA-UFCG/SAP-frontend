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
          ?.replace(/["\\\r\n]/gu, " ")
          .trim();
        return `${safeName};dur=${durationMs.toFixed(1)}${
          safeDescription ? `;desc="${safeDescription}"` : ""
        }`;
      })
      .join(", ");
  }

  return { record, start, header };
}
