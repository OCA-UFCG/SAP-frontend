import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getHealthReportMock,
  statfsMock,
  readFileMock,
  getContentfulUsageMock,
  trafficMap,
} = vi.hoisted(() => ({
  getHealthReportMock: vi.fn(),
  statfsMock: vi.fn(),
  readFileMock: vi.fn(),
  getContentfulUsageMock: vi.fn(),
  trafficMap: new Map<string, { requests: number; bytes: number }>(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/app/api/health/checks", () => ({
  getHealthReport: getHealthReportMock,
}));

vi.mock("@/infrastructure/contentful/usage", () => ({
  getContentfulUsage: getContentfulUsageMock,
}));

vi.mock("@/infrastructure/contentful/traffic", () => ({
  getContentfulTraffic: () => trafficMap,
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  const mocked = { ...actual, statfs: statfsMock, readFile: readFileMock };
  return { ...mocked, default: mocked };
});

const PROC_FILES: Record<string, string> = {
  "/proc/meminfo":
    "MemTotal:        4000000 kB\nMemFree:          300000 kB\nMemAvailable:    1000000 kB\n",
  // 2 núcleos; idle 700 + iowait 100 de um total de 1000 centésimos.
  "/proc/stat":
    "cpu  100 0 50 700 100 0 0 50 0 0\ncpu0 50 0 25 350 50 0 0 25 0 0\ncpu1 50 0 25 350 50 0 0 25 0 0\nintr 1\n",
};

import { GET } from "@/app/api/metrics/route";

function request(authorization?: string) {
  return new Request("http://localhost/api/metrics", {
    headers: authorization ? { authorization } : {},
  });
}

const ok = { ok: true, latencyMs: 120 };

beforeEach(() => {
  vi.stubEnv("METRICS_TOKEN", "segredo");
  getHealthReportMock.mockReset().mockResolvedValue({
    status: "fail",
    checkedAt: "2026-10-22T12:00:00.000Z",
    dependencies: {
      gee: { ok: false, latencyMs: 8000, error: "timeout" },
      contentful: ok,
      firebase: ok,
      multicriteria: { ok: false, latencyMs: 30, error: "HTTP 503" },
      smtp: ok,
    },
  });
  // 100 blocos de 1 KB: 60 usados, 40 livres, 10 deles reservados ao root.
  statfsMock
    .mockReset()
    .mockResolvedValue({ blocks: 100, bfree: 40, bavail: 30, bsize: 1024 });
  readFileMock
    .mockReset()
    .mockImplementation(async (path: string) => PROC_FILES[path]);
  getContentfulUsageMock.mockReset().mockResolvedValue({
    monthToDate: { gql: 46556, cda: 205, cpa: 2, cma: 35407 },
    projectedMonthTotal: 96000,
    limit: 100000,
  });
  trafficMap.clear();
  trafficMap.set("graphql", { requests: 12, bytes: 3400 });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/metrics", () => {
  it("does not exist when no token is configured", async () => {
    vi.stubEnv("METRICS_TOKEN", "");

    const response = await GET(request("Bearer "));

    expect(response.status).toBe(404);
    expect(getHealthReportMock).not.toHaveBeenCalled();
  });

  it("refuses a request without the right token", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer errado"))).status).toBe(401);
    expect(getHealthReportMock).not.toHaveBeenCalled();
  });

  it("reports each dependency, its failure and the VM disk", async () => {
    const response = await GET(request("Bearer segredo"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toContain('sedes_dependency_up{dependency="contentful"} 1');
    expect(body).toContain(
      'sedes_dependency_up{dependency="gee",error="timeout"} 0',
    );
    expect(body).toContain(
      'sedes_dependency_up{dependency="multicriteria",error="HTTP 503"} 0',
    );
    expect(body).toContain(
      'sedes_dependency_latency_seconds{dependency="gee"} 8',
    );
    expect(body).toContain("sedes_disk_used_ratio 0.6666666666666666");
    expect(body).toContain("sedes_disk_free_bytes 30720");
  });

  it("reports the VM memory and CPU read from the host /proc", async () => {
    const body = await (await GET(request("Bearer segredo"))).text();

    expect(body).toContain("sedes_memory_total_bytes 4096000000");
    expect(body).toContain("sedes_memory_available_bytes 1024000000");
    expect(body).toContain("sedes_cpu_count 2");
    expect(body).toContain("sedes_cpu_seconds_total 10");
    expect(body).toContain("sedes_cpu_idle_seconds_total 8");
    expect(body).toMatch(/sedes_process_resident_memory_bytes \d+/);
  });

  it("reports the Contentful quota for the month and this server's calls to it", async () => {
    const body = await (await GET(request("Bearer segredo"))).text();

    expect(body).toContain(
      'sedes_contentful_api_requests_month{api="gql"} 46556',
    );
    expect(body).toContain(
      'sedes_contentful_api_requests_month{api="cma"} 35407',
    );
    expect(body).toContain(
      "sedes_contentful_api_requests_month_projected 96000",
    );
    expect(body).toContain("sedes_contentful_api_requests_limit 100000");
    expect(body).toContain('sedes_contentful_requests_total{api="graphql"} 12');
    expect(body).toContain(
      'sedes_contentful_response_bytes_total{api="graphql"} 3400',
    );
  });

  it("leaves out what it cannot read and keeps the rest", async () => {
    readFileMock.mockRejectedValue(new Error("ENOENT"));
    getContentfulUsageMock.mockResolvedValue(null);

    const body = await (await GET(request("Bearer segredo"))).text();

    expect(body).toContain('sedes_dependency_up{dependency="smtp"} 1');
    expect(body).not.toContain("sedes_memory_total_bytes");
    expect(body).not.toContain("sedes_cpu_seconds_total");
    expect(body).not.toContain("sedes_contentful_api_requests_month");
  });

  it("still reports the dependencies when the disk cannot be read", async () => {
    statfsMock.mockRejectedValue(new Error("EACCES"));

    const body = await (await GET(request("Bearer segredo"))).text();

    expect(body).toContain('sedes_dependency_up{dependency="smtp"} 1');
    expect(body).not.toContain("sedes_disk_used_ratio");
  });
});
