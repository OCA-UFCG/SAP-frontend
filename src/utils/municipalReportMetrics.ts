"use client";

interface ReportMetric {
  etapa: string;
  inicioMs: number;
  duracaoMs: number;
  servidorMs?: number;
  detalhes?: string;
}

interface ReportMetricsSession {
  startedAt: number;
  metrics: ReportMetric[];
  metadata: Record<string, string | number>;
  completed: boolean;
}

declare global {
  interface Window {
    __municipalReportMetrics?: ReportMetricsSession;
  }
}

function now() {
  return performance.now();
}

function session() {
  if (!window.__municipalReportMetrics?.completed) {
    window.__municipalReportMetrics ??= {
      startedAt: now(),
      metrics: [],
      metadata: {},
      completed: false,
    };
    return window.__municipalReportMetrics;
  }

  window.__municipalReportMetrics = {
    startedAt: now(),
    metrics: [],
    metadata: {},
    completed: false,
  };
  return window.__municipalReportMetrics;
}

export function startMunicipalReportMetrics(
  metadata: Record<string, string | number>,
) {
  window.__municipalReportMetrics = {
    startedAt: now(),
    metrics: [],
    metadata,
    completed: false,
  };
  console.info("[Relatorio municipal] Medição iniciada", metadata);
}

export function startMunicipalReportStage(startedAt = now()) {
  return (
    etapa: string,
    options: {
      response?: Response;
      detalhes?: string;
      durationMs?: number;
    } = {},
  ) => {
    const durationMs = options.durationMs ?? now() - startedAt;
    const serverTiming = options.response
      ? parseServerTiming(options.response.headers.get("Server-Timing"))
      : [];
    const servidorMs = serverTiming.find((metric) => metric.name === "total")
      ?.durationMs;
    const metric = {
      etapa,
      inicioMs: startedAt - session().startedAt,
      duracaoMs: durationMs,
      servidorMs,
      detalhes: options.detalhes,
    };
    session().metrics.push(metric);

    console.groupCollapsed(
      `[Relatorio municipal] ${etapa}: ${formatMs(durationMs)}`,
    );
    console.table([
      {
        etapa,
        "navegador (ms)": round(durationMs),
        "servidor (ms)": servidorMs === undefined ? "-" : round(servidorMs),
        detalhes: options.detalhes ?? "-",
      },
    ]);
    if (serverTiming.length > 0) console.table(serverTiming);
    console.groupEnd();
  };
}

export function recordMunicipalReportNavigation() {
  const current = session();
  const durationMs = now() - current.startedAt;
  const finish = startMunicipalReportStage(current.startedAt);
  finish("Clique -> início do carregamento", {
    durationMs,
    detalhes: "Navegação e montagem da tela de prévia",
  });
}

export function finishMunicipalReportMetrics(details?: string) {
  const current = session();
  if (current.completed) return;
  const totalMs = now() - current.startedAt;
  current.completed = true;

  console.group(
    `[Relatorio municipal] RELATORIO PRONTO em ${formatMs(totalMs)}`,
  );
  console.info("Contexto", current.metadata);
  console.table(
    current.metrics.map((metric) => ({
      etapa: metric.etapa,
      "inicio após clique (ms)": round(metric.inicioMs),
      "duração navegador (ms)": round(metric.duracaoMs),
      "tempo servidor (ms)":
        metric.servidorMs === undefined ? "-" : round(metric.servidorMs),
      detalhes: metric.detalhes ?? "-",
    })),
  );
  console.info("Tempo total até download disponível", `${round(totalMs)} ms`);
  if (details) console.info(details);
  console.info(
    "Leitura: etapas com inícios sobrepostos são paralelas; etapas que começam após o término da anterior são seriais.",
  );
  console.groupEnd();
}

interface ParsedServerTiming {
  name: string;
  durationMs: number;
  description: string;
}

function parseServerTiming(value: string | null): ParsedServerTiming[] {
  if (!value) return [];
  return value.split(",").flatMap((entry) => {
    const [rawName, ...parameters] = entry.trim().split(";");
    if (!rawName) return [];
    const duration = parameters.find((parameter) =>
      parameter.trim().startsWith("dur="),
    );
    const description = parameters.find((parameter) =>
      parameter.trim().startsWith("desc="),
    );
    const durationMs = Number(duration?.trim().slice(4));
    return [{
      name: rawName,
      durationMs: Number.isFinite(durationMs) ? durationMs : 0,
      description: description?.trim().slice(5).replace(/^"|"$/gu, "") ?? "",
    }];
  });
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function formatMs(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${round(value)} ms`;
}
