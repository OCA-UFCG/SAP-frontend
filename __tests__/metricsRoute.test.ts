import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getHealthReportMock, statfsMock } = vi.hoisted(() => ({
  getHealthReportMock: vi.fn(),
  statfsMock: vi.fn(),
}));

vi.mock("@/app/api/health/checks", () => ({
  getHealthReport: getHealthReportMock,
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  const mocked = { ...actual, statfs: statfsMock };
  return { ...mocked, default: mocked };
});

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

  it("still reports the dependencies when the disk cannot be read", async () => {
    statfsMock.mockRejectedValue(new Error("EACCES"));

    const body = await (await GET(request("Bearer segredo"))).text();

    expect(body).toContain('sedes_dependency_up{dependency="smtp"} 1');
    expect(body).not.toContain("sedes_disk_used_ratio");
  });
});
