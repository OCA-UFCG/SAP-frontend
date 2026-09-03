#!/usr/bin/env node
/**
 * Rampa de concorrência contra o Earth Engine.
 *
 * Responde a pergunta do SED-094 ("uma quantidade grande de requisições pode
 * quebrar o GEE?") medindo onde a latência degrada e onde aparece HTTP 429.
 *
 * O teste é SOMENTE LEITURA: filtra uma FeatureCollection estatística por
 * código de município, exatamente como `geeStatisticsRepository` faz a cada
 * requisição de `/api/municipal-analysis`. Não escreve, não exporta e não cria
 * task nenhuma no Earth Engine.
 *
 * Ele mede o SDK do Earth Engine dentro de um processo Node, que é o mesmo
 * caminho que a aplicação usa — e não a aplicação inteira. É de propósito:
 * medir pela rota HTTP misturaria a fila do Node, o cache em memória e o
 * proxy reverso na mesma leitura.
 *
 * Uso:
 *   node tools/gee-load-test/gee-concurrency-ramp.mjs
 *   node tools/gee-load-test/gee-concurrency-ramp.mjs --levels 1,8,32 --asset projects/.../X
 *   node tools/gee-load-test/gee-concurrency-ramp.mjs --json > medicao.json
 *
 * Requer `GEE_PRIVATE_KEY` no ambiente (o JSON completo da service account),
 * a mesma variável que o servidor usa.
 */
import process from "node:process";

import ee from "@google/earthengine";

const DEFAULT_ASSET =
  "projects/obscaatinga/assets/Estatisticas/Estatistica_Multinivel_MonitorANA_2025";
const DEFAULT_LEVELS = [1, 4, 8, 16, 24, 32, 40, 48];

/**
 * Códigos IBGE reais do semiárido. A consulta varia de município a cada
 * requisição para não medir um cache de resultado do lado do Earth Engine.
 */
const MUNICIPALITY_CODES = [
  "2507507",
  "2504009",
  "2408102",
  "2611606",
  "2927408",
  "2304400",
  "2211001",
  "3143302",
  "2916104",
  "2513653",
  "2409407",
  "2610707",
  "2503209",
  "2802908",
  "2101202",
  "3106200",
  "2607901",
  "2919926",
  "2408003",
  "2513158",
  "2504801",
  "2402808",
  "2211201",
  "2919553",
  "2611101",
  "2306256",
  "2507200",
  "2408003",
];

function readFlag(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index === process.argv.length - 1) return fallback;
  return process.argv[index + 1];
}

function parseServiceAccountKey() {
  const raw = process.env.GEE_PRIVATE_KEY;
  if (!raw) {
    throw new Error(
      "Missing required environment variable: GEE_PRIVATE_KEY (JSON completo da service account, com client_email e private_key)",
    );
  }
  const key = JSON.parse(raw);
  if (!key.client_email || !key.private_key) {
    throw new Error(
      `GEE_PRIVATE_KEY inválida: esperado JSON com client_email e private_key, recebido chaves [${Object.keys(key).join(", ")}]`,
    );
  }
  return key;
}

function authenticate(key) {
  return new Promise((resolve, reject) =>
    ee.data.authenticateViaPrivateKey(key, resolve, reject),
  );
}

function initialize(projectId) {
  return new Promise((resolve, reject) =>
    ee.initialize(null, null, resolve, reject, null, projectId),
  );
}

function classifyError(message) {
  if (/429|too many|quota|rate limit/iu.test(message)) return "429/cota";
  if (/timeout|ETIMEDOUT|ECONNRESET|socket/iu.test(message))
    return "timeout/conexão";
  if (/not found|does not exist|permission|access/iu.test(message))
    return "asset/permissão";
  return "outro";
}

function issueRequest(assetId, index) {
  const code = MUNICIPALITY_CODES[index % MUNICIPALITY_CODES.length];
  const startedAt = process.hrtime.bigint();
  return new Promise((resolve) => {
    const rows = new ee.FeatureCollection(assetId).filter(
      ee.Filter.eq("CD_MUN", code),
    );
    rows.toList(1).evaluate((_value, error) => {
      const ms = Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6);
      resolve({
        ms,
        ok: !error,
        error: error ? String(error).slice(0, 240) : null,
      });
    });
  });
}

function percentile(sortedLatencies, p) {
  if (!sortedLatencies.length) return null;
  const position = Math.floor((p / 100) * sortedLatencies.length);
  return sortedLatencies[Math.min(sortedLatencies.length - 1, position)];
}

function summarize(level, results, wallMs) {
  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const latencies = ok.map((r) => r.ms).sort((a, b) => a - b);
  const errorKinds = {};
  for (const failure of failed) {
    const kind = classifyError(failure.error);
    errorKinds[kind] = (errorKinds[kind] ?? 0) + 1;
  }
  return {
    concorrencia: level,
    wall_ms: wallMs,
    ok: ok.length,
    erros: failed.length,
    tipos_de_erro: errorKinds,
    p50_ms: percentile(latencies, 50),
    p95_ms: percentile(latencies, 95),
    max_ms: latencies.at(-1) ?? null,
    vazao_req_s: Number((results.length / (wallMs / 1000)).toFixed(2)),
    amostra_de_erro: failed[0]?.error ?? null,
  };
}

async function runLevel(assetId, level, offset) {
  const wallStart = process.hrtime.bigint();
  const results = await Promise.all(
    Array.from({ length: level }, (_unused, i) =>
      issueRequest(assetId, offset + i),
    ),
  );
  const wallMs = Math.round(Number(process.hrtime.bigint() - wallStart) / 1e6);
  return summarize(level, results, wallMs);
}

async function main() {
  const asJson = process.argv.includes("--json");
  const assetId = readFlag("asset", DEFAULT_ASSET);
  const levels = readFlag("levels", "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
  const ramp = levels.length ? levels : DEFAULT_LEVELS;
  const key = parseServiceAccountKey();
  const projectId = process.env.GEE_PROJECT_ID || key.project_id;

  const log = (line) => (asJson ? console.error(line) : console.log(line));
  log(`Projeto consumidor: ${projectId}`);
  log(`Service account: ${key.client_email}`);
  log(`Asset: ${assetId}`);
  log(
    `Total de requisições: ${ramp.reduce((sum, n) => sum + n, 0)} (níveis ${ramp.join(", ")})`,
  );
  log("");

  await authenticate(key);
  await initialize(projectId);

  const report = [];
  let issued = 0;
  for (const level of ramp) {
    const summary = await runLevel(assetId, level, issued);
    issued += level;
    report.push(summary);
    log(
      `concorrência ${String(level).padStart(3)} | ` +
        `tempo total ${String(summary.wall_ms).padStart(6)} ms | ` +
        `vazão ${String(summary.vazao_req_s).padStart(5)} req/s | ` +
        `p50 ${String(summary.p50_ms).padStart(6)} ms | ` +
        `p95 ${String(summary.p95_ms).padStart(6)} ms | ` +
        `erros ${summary.erros}` +
        (summary.erros ? ` ${JSON.stringify(summary.tipos_de_erro)}` : ""),
    );
  }

  const output = {
    projeto: projectId,
    asset: assetId,
    total_requisicoes: issued,
    report,
  };
  if (asJson) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const saturacao = report.at(-1);
  log("");
  log(
    `Vazão máxima observada: ${Math.max(...report.map((r) => r.vazao_req_s))} req/s.`,
  );
  log(
    `Erros 429 em toda a rampa: ${report.reduce((sum, r) => sum + (r.tipos_de_erro["429/cota"] ?? 0), 0)}.`,
  );
  log(
    `No maior nível (${saturacao.concorrencia} simultâneas) o p95 foi de ${saturacao.p95_ms} ms.`,
  );
}

main().catch((error) => {
  console.error(`[gee-load-test] ${error.message}`);
  process.exitCode = 1;
});
