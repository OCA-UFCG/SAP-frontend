import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-session", () => ({ requireAuthenticatedRequest: vi.fn() }));
vi.mock("@/services/municipalReportService", () => ({
  MunicipalReportNotFoundError: class MunicipalReportNotFoundError extends Error {},
}));
vi.mock("@/services/municipalReportCache", () => ({
  buildCachedMunicipalReport: vi.fn(),
}));
vi.mock("@/repositories/platform/municipalAnalysisCache", () => ({
  getMunicipalAnalysisCacheControlHeader: () => "private, max-age=600",
}));

import { GET } from "@/app/api/municipal-report/[municipalityCode]/route";
import { requireAuthenticatedRequest } from "@/lib/server-session";
import { MunicipalReportNotFoundError } from "@/services/municipalReportService";
import { buildCachedMunicipalReport } from "@/services/municipalReportCache";

const auth = vi.mocked(requireAuthenticatedRequest);
const build = vi.mocked(buildCachedMunicipalReport);
const context = (code: string) => ({ params: Promise.resolve({ municipalityCode: code }) });

describe("GET /api/municipal-report/[municipalityCode]", () => {
  beforeEach(() => { vi.resetAllMocks(); auth.mockResolvedValue(null); });

  it("requires authentication", async () => {
    auth.mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));
    const response = await GET(new Request("https://test/api/municipal-report/5200050?period=2024"), context("5200050"));
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(build).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid", "2024"], ["5200050", ""], ["5200050", "2024-13"],
  ])("returns 400 for invalid input", async (code, period) => {
    const response = await GET(new Request(`https://test/api/municipal-report/${code}?period=${period}`), context(code));
    expect(response.status).toBe(400);
  });

  it("returns a cached report when at least one analysis is available", async () => {
    build.mockResolvedValueOnce({ analyses: [{ status: "available" }] } as never);
    const response = await GET(new Request("https://test/api/municipal-report/5200050?period=2024"), context("5200050"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=600");
  });

  it("returns 502 when no analysis can be built", async () => {
    build.mockResolvedValueOnce({ analyses: [{ status: "unavailable" }] } as never);
    const response = await GET(new Request("https://test/api/municipal-report/5200050?period=2024"), context("5200050"));
    expect(response.status).toBe(502);
  });

  it("returns 200 with history when the requested period is not found", async () => {
    build.mockResolvedValueOnce({
      analyses: [{ status: "period_not_found", timeSeries: [{ period: "2023" }] }],
    } as never);
    const response = await GET(
      new Request("https://test/api/municipal-report/5200050?period=2024"),
      context("5200050"),
    );
    expect(response.status).toBe(200);
  });

  it("returns 404 for an unknown municipality", async () => {
    build.mockRejectedValueOnce(new MunicipalReportNotFoundError("Municipality not found."));
    const response = await GET(new Request("https://test/api/municipal-report/9999999?period=2024"), context("9999999"));
    expect(response.status).toBe(404);
  });
});
