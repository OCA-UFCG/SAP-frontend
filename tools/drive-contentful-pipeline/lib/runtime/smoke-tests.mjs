import { readMunicipalAnalysisManifest } from "../contentful/municipal-analysis-sync.mjs";

function buildCookieHeader(options) {
  if (options.sessionCookie) return options.sessionCookie;

  if (options.sessionCookieEnv) {
    return process.env[options.sessionCookieEnv] ?? "";
  }

  return "";
}

function getSmokeCandidates(manifest, limit) {
  return (manifest.partitions ?? [])
    .filter((partition) => partition.panelLayerId && partition.yearKeys?.length)
    .sort((left, right) => {
      const leftKey = `${left.panelLayerId}::${left.partitionKey}`;
      const rightKey = `${right.panelLayerId}::${right.partitionKey}`;

      return leftKey.localeCompare(rightKey);
    })
    .slice(0, limit)
    .map((partition) => ({
      panelLayerId: partition.panelLayerId,
      partitionKey: partition.partitionKey,
      yearKey: partition.yearKeys[0],
      imageDataPath: partition.imageDataPath,
    }));
}

export async function runRuntimeSmokeTests(options) {
  const cookie = buildCookieHeader(options);

  if (!options.runtimeBaseUrl) {
    return {
      status: "skipped",
      reason: "--runtime-base-url não informado.",
      tested: 0,
      passed: 0,
      failed: 0,
      results: [],
    };
  }

  if (!cookie) {
    return {
      status: "skipped",
      reason:
        "--session-cookie ou --session-cookie-env é necessário porque a rota é protegida.",
      tested: 0,
      passed: 0,
      failed: 0,
      results: [],
    };
  }

  const manifest = await readMunicipalAnalysisManifest(options.jsonDir);
  const candidates = getSmokeCandidates(manifest, options.smokeLimit);
  const baseUrl = options.runtimeBaseUrl.replace(/\/$/u, "");
  const results = [];

  for (const candidate of candidates) {
    const url = `${baseUrl}/api/municipal-analysis/${encodeURIComponent(
      candidate.panelLayerId,
    )}?year=${encodeURIComponent(candidate.yearKey)}`;
    const startedAt = Date.now();

    try {
      const response = await fetch(url, {
        headers: {
          Cookie: cookie,
        },
      });
      const body = await response.json().catch(() => null);
      const ok =
        response.ok &&
        body &&
        typeof body === "object" &&
        "imageData" in body &&
        body.imageData != null;

      results.push({
        ...candidate,
        url,
        ok,
        status: response.status,
        cacheControl: response.headers.get("cache-control"),
        durationMs: Date.now() - startedAt,
        error: ok ? null : body?.error ?? "Resposta sem imageData.",
      });
    } catch (error) {
      results.push({
        ...candidate,
        url,
        ok: false,
        status: null,
        cacheControl: null,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const failed = results.filter((result) => !result.ok).length;

  return {
    status: failed > 0 ? "failed" : "passed",
    tested: results.length,
    passed: results.length - failed,
    failed,
    results,
  };
}
