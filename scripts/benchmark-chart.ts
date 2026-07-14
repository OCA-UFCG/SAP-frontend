/**
 * Script de benchmark para geração de gráficos do Relatório Municipal (chart API).
 *
 * Mede:
 *   - Latência da requisição completa
 *   - Tamanho do payload (resposta JSON + PNGs base64 decodificados)
 *   - Breakdown por análise (tamanho da imagem, número de classes, pontos na série)
 *   - Estatísticas em múltiplas iterações (min, max, avg, mediana, p95, p99)
 *   - Comparação cache frio vs quente
 *   - Requisições concorrentes
 *
 * Uso:
 *   SESSION_COOKIE=abc123 npx tsx scripts/benchmark-chart.ts [opções]
 *
 * Opções:
 *   --url <url>             Base URL (default: http://localhost:3000)
 *   --code <IBGE>           Código do município (default: 2504009, Campina Grande)
 *   --periods <p1,p2,...>   Períodos separados por vírgula (default: 2024-01)
 *   --analyses <a1,a2,...>  Análises separadas por vírgula (default: seca,aridez,degradacao)
 *   --iterations <n>        Repetições para cada cenário (default: 5)
 *   --concurrency <n>       Requisições simultâneas (default: 1)
 *   --warmup                Faz uma requisição de aquecimento antes de medir
 *   --output <dir>          Diretório para salvar resultados JSON (default: tmp/benchmark)
 *   --json                  Saída em JSON (para processamento posterior)
 *
 * Exemplos:
 *   SESSION_COOKIE=abc123 npx tsx scripts/benchmark-chart.ts --iterations 10 --warmup
 *   SESSION_COOKIE=abc123 npx tsx scripts/benchmark-chart.ts --concurrency 5 --iterations 3
 *   SESSION_COOKIE=abc123 npx tsx scripts/benchmark-chart.ts --periods "1990,2000,2010,2024-01" --json
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag: string, fallback: string): string => {
  const i = args.indexOf(flag);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
};
const hasFlag = (flag: string) => args.includes(flag);

const BASE_URL = getArg("--url", "http://localhost:3000");
const CODE = getArg("--code", "2504009");
const PERIODS = getArg("--periods", "2024-01").split(",").map((s) => s.trim());
const ANALYSES = getArg("--analyses", "seca,aridez,degradacao").split(",").map((s) => s.trim());
const ITERATIONS = Number.parseInt(getArg("--iterations", "5"), 10);
const CONCURRENCY = Number.parseInt(getArg("--concurrency", "1"), 10);
const OUTPUT_DIR = getArg("--output", "tmp/benchmark");
const DO_WARMUP = hasFlag("--warmup");
const OUTPUT_JSON = hasFlag("--json");

const SESSION_COOKIE = process.env.SESSION_COOKIE;
if (!SESSION_COOKIE) {
  console.error("❌  Defina SESSION_COOKIE com o cookie de sessão (session=<valor>).");
  console.error("   export SESSION_COOKIE=$(copie do DevTools → Application → Cookies → session)");
  process.exit(1);
}

const HEADERS = { Cookie: `session=${SESSION_COOKIE}` };

// ─── Types ───────────────────────────────────────────────────────────────────
interface ChartResult {
  analysisId: string;
  alias: string;
  title: string;
  pngSizeKB: number;
  pngSizeBytes: number;
}

interface ServerTimings {
  /** ms para buildMunicipalReport (carregar dados + montar relatório) */
  buildReportMs: number | null;
  /** ms para renderizar todos os charts (ChartJSNodeCanvas) */
  renderChartsMs: number | null;
  /** ms total no servidor */
  totalServerMs: number | null;
  /** ms por chart (alias → ms) */
  perChart: Record<string, number>;
}

interface RequestSample {
  /** Sequencial */
  iteration: number;
  /** Período requisitado */
  period: string;
  /** URL completa */
  url: string;
  /** HTTP status */
  status: number;
  /** Tempo total em ms (fetch → body lido) */
  totalMs: number;
  /** Tempo até o primeiro byte (TTFB) em ms */
  ttfbMs: number;
  /** Tamanho do response body em KB */
  responseSizeKB: number;
  /** Erro, se houver */
  error: string | null;
  /** Timings do servidor (via headers X-Timing-*) */
  serverTimings: ServerTimings;
  /** Detalhes por chart */
  charts: ChartResult[];
  /** Quantas análises retornaram */
  chartCount: number;
  /** Total de pontos nas séries temporais */
  totalDataPoints: number;
}

interface ScenarioResult {
  label: string;
  url: string;
  samples: RequestSample[];
  /** Estatísticas calculadas */
  stats: {
    totalMs: Stats;
    ttfbMs: Stats;
    responseSizeKB: Stats;
    pngSizeKB: Stats;
    chartCount: Stats;
    totalDataPoints: Stats;
    /** Server-side timings */
    buildReportMs: Stats;
    renderChartsMs: Stats;
    totalServerMs: Stats;
  };
  errors: number;
}

interface Stats {
  min: number;
  max: number;
  avg: number;
  median: number;
  p95: number;
  p99: number;
  values: number[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function computeStats(values: number[]): Stats {
  const sorted = [...values].sort((a, b) => a - b);
  const len = sorted.length;
  const avg = sorted.reduce((s, v) => s + v, 0) / len;
  const median = len % 2 === 0
    ? (sorted[len / 2 - 1] + sorted[len / 2]) / 2
    : sorted[Math.floor(len / 2)];
  const p95 = sorted[Math.ceil(len * 0.95) - 1] ?? sorted[len - 1];
  const p99 = sorted[Math.ceil(len * 0.99) - 1] ?? sorted[len - 1];
  return { min: sorted[0], max: sorted[len - 1], avg, median, p95, p99, values };
}

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms.toFixed(1)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

function formatKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function bar(value: number, max: number, width = 20): string {
  const filled = Math.round((value / max) * width);
  return "█".repeat(filled).padEnd(width, "░");
}

// ─── Core: fetch com timing ──────────────────────────────────────────────────
function parseServerTimings(response: Response): ServerTimings {
  const get = (name: string): number | null => {
    const v = response.headers.get(name);
    return v ? Number.parseInt(v, 10) : null;
  };

  const perChart: Record<string, number> = {};
  for (const [key, val] of response.headers.entries()) {
    const match = key.match(/^x-timing-render-(.+)$/i);
    if (match && val) {
      perChart[match[1]] = Number.parseInt(val, 10);
    }
  }

  return {
    buildReportMs: get("X-Timing-BuildReport"),
    renderChartsMs: get("X-Timing-RenderCharts"),
    totalServerMs: get("X-Timing-Total"),
    perChart,
  };
}

async function fetchWithTiming(
  url: string,
  iteration: number,
  period: string,
): Promise<RequestSample> {
  const start = performance.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const response = await fetch(url, { headers: HEADERS, signal: controller.signal });
    const ttfb = performance.now() - start;
    clearTimeout(timeout);

    const serverTimings = parseServerTimings(response);

    const body = await response.arrayBuffer();
    const total = performance.now() - start;
    const responseSizeKB = body.byteLength / 1024;

    if (!response.ok) {
      const text = new TextDecoder().decode(body);
      return {
        iteration, period, url,
        status: response.status,
        totalMs: total, ttfbMs: ttfb,
        responseSizeKB,
        serverTimings,
        error: `HTTP ${response.status}: ${text.slice(0, 200)}`,
        charts: [], chartCount: 0, totalDataPoints: 0,
      };
    }

    const json = JSON.parse(new TextDecoder().decode(body));
    const charts: ChartResult[] = (json.charts ?? []).map((chartItem: { base64?: string; title?: string; alias?: string; analysisId?: string }) => {
      const raw = chartItem.base64 ?? "";
      const bytes = Buffer.from(raw, "base64").length;
      return {
        analysisId: chartItem.analysisId ?? "?",
        alias: chartItem.alias ?? "?",
        title: chartItem.title ?? "?",
        pngSizeKB: bytes / 1024,
        pngSizeBytes: bytes,
      };
    });

    const totalDataPoints = charts.length;

    return {
      iteration, period, url,
      status: response.status,
      totalMs: total, ttfbMs: ttfb,
      responseSizeKB,
      serverTimings,
      error: null,
      charts,
      chartCount: charts.length,
      totalDataPoints,
    };
  } catch (err: unknown) {
    const elapsed = performance.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    return {
      iteration, period, url,
      status: 0, totalMs: elapsed, ttfbMs: elapsed,
      responseSizeKB: 0,
      serverTimings: { buildReportMs: null, renderChartsMs: null, totalServerMs: null, perChart: {} },
      error: msg,
      charts: [], chartCount: 0, totalDataPoints: 0,
    };
  }
}

// ─── Scenario runner ─────────────────────────────────────────────────────────
async function runScenario(
  label: string,
  url: string,
  iterations: number,
  concurrency: number,
): Promise<ScenarioResult> {
  const samples: RequestSample[] = [];

  // Extrair período da URL para registro
  const periodMatch = url.match(/period=([^&]+)/);
  const period = periodMatch?.[1] ?? "?";

  if (!OUTPUT_JSON) {
    console.log(`\n  Cenário: ${label}`);
    console.log(`  URL:      ${url}`);
    console.log(`  Rounds:   ${iterations} × ${concurrency} concorrente(s)\n`);
  }

  for (let i = 0; i < iterations; i++) {
    if (concurrency <= 1) {
      // Sequencial
      const sample = await fetchWithTiming(url, i + 1, period);
      samples.push(sample);
      if (!OUTPUT_JSON) {
        printSample(sample, i, iterations);
      }
    } else {
      // Concorrente
      const batch = await Promise.all(
        Array.from({ length: concurrency }, (_, j) =>
          fetchWithTiming(url, i * concurrency + j + 1, period)),
      );
      samples.push(...batch);
      if (!OUTPUT_JSON) {
        for (const s of batch) {
          printSample(s, s.iteration, iterations * concurrency);
        }
      }
    }
  }

  const successful = samples.filter((s) => !s.error);
  const pngSizes = successful.flatMap((s) => s.charts.map((c) => c.pngSizeBytes));
  const buildMs = successful.map((s) => s.serverTimings.buildReportMs).filter((v): v is number => v !== null);
  const renderMs = successful.map((s) => s.serverTimings.renderChartsMs).filter((v): v is number => v !== null);
  const totalSrvMs = successful.map((s) => s.serverTimings.totalServerMs).filter((v): v is number => v !== null);

  const stats = {
    totalMs: computeStats(successful.map((s) => s.totalMs)),
    ttfbMs: computeStats(successful.map((s) => s.ttfbMs)),
    responseSizeKB: computeStats(successful.map((s) => s.responseSizeKB)),
    pngSizeKB: computeStats(pngSizes.length > 0 ? pngSizes : [0]),
    chartCount: computeStats(successful.map((s) => s.chartCount)),
    totalDataPoints: computeStats(successful.map((s) => s.totalDataPoints)),
    buildReportMs: computeStats(buildMs.length > 0 ? buildMs : [0]),
    renderChartsMs: computeStats(renderMs.length > 0 ? renderMs : [0]),
    totalServerMs: computeStats(totalSrvMs.length > 0 ? totalSrvMs : [0]),
  };

  const errors = samples.filter((s) => s.error).length;

  return { label, url, samples, stats, errors };
}

function printSample(sample: RequestSample, i: number, total: number) {
  const idx = `${i}/${total}`.padStart(8);
  const ok = sample.error ? "❌" : "✅";
  const status = sample.status ? `HTTP ${sample.status}` : "ERR";
  const time = formatMs(sample.totalMs).padStart(10);
  const size = formatKB(sample.responseSizeKB).padStart(9);
  const charts = `${sample.chartCount} gráfico(s)`;
  const detail = sample.error ? ` — ${sample.error.slice(0, 80)}` : "";
  const srv = sample.serverTimings.totalServerMs !== null
    ? `serv: ${formatMs(sample.serverTimings.totalServerMs)}`
    : "";
  console.log(`    ${idx} ${ok} ${status} │ ${time} │ ${size} │ ${charts} │ ${srv}${detail}`);
}

// ─── Report ──────────────────────────────────────────────────────────────────
function printSummary(results: ScenarioResult[]) {
  const width = 100;
  console.log("\n" + "═".repeat(width));
  console.log("  📊  RELATÓRIO DE BENCHMARK — Geração de Gráficos");
  console.log("═".repeat(width));
  console.log(`  URL base:    ${BASE_URL}`);
  console.log(`  Município:   ${CODE}`);
  console.log(`  Análises:    ${ANALYSES.join(", ")}`);
  console.log(`  Períodos:    ${PERIODS.join(", ")}`);
  console.log(`  Iterações:   ${ITERATIONS} por cenário`);
  console.log(`  Concorrência: ${CONCURRENCY}`);
  console.log(`  Aquecimento: ${DO_WARMUP ? "sim" : "não"}`);
  console.log("─".repeat(width));

  // Tabela de resultados
  console.log("\n  Resumo por cenário:\n");
  const header = `  ${"Cenário".padEnd(30)} │ ${"Média".padEnd(8)} │ ${"p95".padEnd(8)} │ ${"Servidor".padEnd(10)} │ ${"Build".padEnd(8)} │ ${"Render".padEnd(8)} │ ${"Tamanho".padEnd(9)} │ Erros`;
  console.log(header);
  console.log("  " + "─".repeat(header.length - 2));

  const allTotalMs: number[] = [];
  const allTtfbMs: number[] = [];
  const allPngSizes: number[] = [];
  const allBuildMs: number[] = [];
  const allRenderMs: number[] = [];

  for (const r of results) {
    const s = r.stats.totalMs;
    const size = r.stats.responseSizeKB;
    const build = r.stats.buildReportMs;
    const render = r.stats.renderChartsMs;
    const label = r.label.length > 29 ? r.label.slice(0, 26) + "..." : r.label;
    console.log(
      `  ${label.padEnd(30)} │ ${formatMs(s.avg).padEnd(8)} │ ${formatMs(s.p95).padEnd(8)} │ ${formatMs(r.stats.totalServerMs.avg).padEnd(10)} │ ${formatMs(build.avg).padEnd(8)} │ ${formatMs(render.avg).padEnd(8)} │ ${size.avg.toFixed(0).padStart(4)} KB │ ${r.errors}`,
    );

    // Barra visual da média (full request)
    const maxAvg = Math.max(...results.map((scenario) => scenario.stats.totalMs.avg), 1);
    console.log(`  ${"".padEnd(30)}   ${bar(s.avg, maxAvg)}  ${formatMs(s.avg)} full request`);
    // Barra do servidor
    const maxSrv = Math.max(...results.map((scenario) => scenario.stats.totalServerMs.avg), 1);
    console.log(`  ${"".padEnd(30)}   ${bar(r.stats.totalServerMs.avg, maxSrv)}  ${formatMs(r.stats.totalServerMs.avg)} servidor`);
    console.log();

    allTotalMs.push(...r.stats.totalMs.values);
    allTtfbMs.push(...r.stats.ttfbMs.values);
    allPngSizes.push(...r.stats.pngSizeKB.values);
    allBuildMs.push(...r.stats.buildReportMs.values);
    allRenderMs.push(...r.stats.renderChartsMs.values);
  }

  // Totais globais
  if (results.length > 1) {
    const globalTotal = computeStats(allTotalMs);
    const globalTtfb = computeStats(allTtfbMs);
    const globalPng = computeStats(allPngSizes);
    const totalErrors = results.reduce((s, r) => s + r.errors, 0);
    const totalSamples = results.reduce((s, r) => s + r.samples.length, 0);

    const globalBuild = computeStats(allBuildMs);
    const globalRender = computeStats(allRenderMs);

    console.log("─".repeat(width));
    console.log(`  GLOBAL (${totalSamples} amostras, ${totalErrors} erros):`);
    console.log(`    Latência total:   ${formatMs(globalTotal.avg)} média · ${formatMs(globalTotal.min)} min · ${formatMs(globalTotal.max)} máx · p95 ${formatMs(globalTotal.p95)}`);
    console.log(`    TTFB:             ${formatMs(globalTtfb.avg)} média · ${formatMs(globalTtfb.min)} min · ${formatMs(globalTtfb.max)} máx · p95 ${formatMs(globalTtfb.p95)}`);
    console.log(`    Servidor (total): ${formatMs(globalTotal.avg)} média · breakdown: buildReport ${formatMs(globalBuild.avg)} → render ${formatMs(globalRender.avg)}`);
    console.log(`    PNG por chart:    ${globalPng.avg.toFixed(1)} KB médio · ${globalPng.min.toFixed(1)} min · ${globalPng.max.toFixed(1)} máx`);
    console.log(`    Taxa de erro:     ${(totalErrors / totalSamples * 100).toFixed(1)}%`);
  }
}

function printPerChartBreakdown(results: ScenarioResult[]) {
  // Agrupa samples por alias do chart
  const chartMap = new Map<string, number[]>();
  for (const r of results) {
    for (const s of r.samples) {
      for (const chartResult of s.charts) {
        const key = `${chartResult.alias} (${chartResult.analysisId})`;
        if (!chartMap.has(key)) chartMap.set(key, []);
        chartMap.get(key)!.push(chartResult.pngSizeBytes);
      }
    }
  }

  console.log("\n  Breakdown por análise:\n");
  const header = `  ${"Análise".padEnd(30)} │ ${"Média".padEnd(8)} │ ${"Mín".padEnd(8)} │ ${"Máx".padEnd(8)} │ ${"Amostras"}`;
  console.log(header);
  console.log("  " + "─".repeat(header.length - 2));

  for (const [key, sizes] of chartMap) {
    if (sizes.length === 0) continue;
    const avg = sizes.reduce((s, v) => s + v, 0) / sizes.length;
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    const label = key.length > 29 ? key.slice(0, 26) + "..." : key;
    console.log(`  ${label.padEnd(30)} │ ${formatKB(avg).padEnd(8)} │ ${formatKB(min).padEnd(8)} │ ${formatKB(max).padEnd(8)} │ ${sizes.length}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const outDir = resolve(OUTPUT_DIR);
  mkdirSync(outDir, { recursive: true });

  // Header
  if (!OUTPUT_JSON) {
    console.log("");
    console.log("  ⚡  BENCHMARK DE GRÁFICOS — Relatório Municipal");
    console.log(`  ${new Date().toISOString()}`);
    console.log(`  ${BASE_URL} · código ${CODE} · análises: ${ANALYSES.join(", ")}`);
    console.log(`  ${ITERATIONS} iteração(ões) · ${CONCURRENCY} concorrência`);
    console.log("");
  }

  const results: ScenarioResult[] = [];

  // 1. Warmup (opcional)
  if (DO_WARMUP) {
    const warmUrl = `${BASE_URL}/api/municipal-report/${CODE}/chart?period=${PERIODS[0]}&analysis=${ANALYSES[0]}`;
    if (!OUTPUT_JSON) {
      console.log("  🔥 Aquecimento (cache frio)...");
    }
    const warmupSample = await fetchWithTiming(warmUrl, 0, PERIODS[0]);
    if (!OUTPUT_JSON) {
      console.log(`     ${warmupSample.error ? "❌" : "✅"} ${formatMs(warmupSample.totalMs)} · ${formatKB(warmupSample.responseSizeKB)} · ${warmupSample.chartCount} gráfico(s)`);
      if (warmupSample.error) console.log(`     ⚠️  ${warmupSample.error}`);
      console.log("");
    }
  }

  // 2. Cenários por período + análises
  for (const period of PERIODS) {
    const analysisParam = ANALYSES.join(",");
    const url = `${BASE_URL}/api/municipal-report/${CODE}/chart?period=${period}&analysis=${analysisParam}`;
    const label = `period=${period} analysis=${analysisParam}`;
    const result = await runScenario(label, url, ITERATIONS, CONCURRENCY);
    results.push(result);
  }

  // 3. Cenário extra: cada análise individual (se múltiplas)
  if (ANALYSES.length > 1) {
    for (const analysis of ANALYSES) {
      const period = PERIODS[0];
      const url = `${BASE_URL}/api/municipal-report/${CODE}/chart?period=${period}&analysis=${analysis}`;
      const label = `individual: ${analysis}`;
      const result = await runScenario(label, url, ITERATIONS, CONCURRENCY);
      results.push(result);
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  printSummary(results);
  printPerChartBreakdown(results);

  // ─── Salvar resultados ────────────────────────────────────────────────────
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const resultFile = resolve(outDir, `benchmark-${CODE}-${timestamp}.json`);
  const resultData = {
    metadata: {
      timestamp: new Date().toISOString(),
      baseUrl: BASE_URL,
      municipalityCode: CODE,
      analyses: ANALYSES,
      periods: PERIODS,
      iterations: ITERATIONS,
      concurrency: CONCURRENCY,
      warmup: DO_WARMUP,
    },
    results: results.map((r) => ({
      label: r.label,
      url: r.url,
      errors: r.errors,
      sampleCount: r.samples.length,
      stats: {
        totalMs: r.stats.totalMs,
        ttfbMs: r.stats.ttfbMs,
        responseSizeKB: r.stats.responseSizeKB,
        pngSizeKB: r.stats.pngSizeKB,
        chartCount: r.stats.chartCount,
      },
      samples: r.samples.map((s) => ({
        iteration: s.iteration,
        status: s.status,
        totalMs: s.totalMs,
        ttfbMs: s.ttfbMs,
        responseSizeKB: s.responseSizeKB,
        error: s.error,
        chartCount: s.chartCount,
        charts: s.charts.map((c) => ({
          analysisId: c.analysisId,
          alias: c.alias,
          title: c.title,
          pngSizeKB: c.pngSizeKB,
        })),
      })),
    })),
  };

  writeFileSync(resultFile, JSON.stringify(resultData, null, 2));
  console.log(`\n  💾  Resultados salvos em: ${resultFile}`);

  // Se OUTPUT_JSON, imprime o JSON completo no stdout
  if (OUTPUT_JSON) {
    console.log(JSON.stringify(resultData, null, 2));
  }

  // ─── Exit status ──────────────────────────────────────────────────────────
  const totalErrors = results.reduce((s, r) => s + r.errors, 0);
  if (totalErrors > 0) {
    console.log(`\n  ⚠️  ${totalErrors} erro(s) encontrado(s) durante o benchmark.\n`);
    process.exitCode = 1;
  } else {
    console.log(`\n  ✅  Benchmark concluído sem erros.\n`);
  }
}

main().catch((err) => {
  console.error("\n❌  Erro fatal:", err);
  process.exit(1);
});
