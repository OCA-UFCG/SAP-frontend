import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-session", () => ({
  requireAuthenticatedRequest: vi.fn(),
}));
vi.mock("@/services/municipalReportService", () => ({
  MunicipalReportNotFoundError: class MunicipalReportNotFoundError extends Error {},
}));
vi.mock("@/services/municipalReportCache", () => ({
  buildCachedMunicipalReport: vi.fn(),
}));
vi.mock("@/repositories/platform/municipalAnalysisCache", () => ({
  getMunicipalAnalysisCacheControlHeader: () => "private, max-age=600",
}));

import { GET } from "@/app/api/municipal-report/[locationKey]/route";
import { requireAuthenticatedRequest } from "@/lib/server-session";
import { MunicipalReportNotFoundError } from "@/services/municipalReportService";
import { buildCachedMunicipalReport } from "@/services/municipalReportCache";

const auth = vi.mocked(requireAuthenticatedRequest);
const build = vi.mocked(buildCachedMunicipalReport);
const context = (code: string) => ({
  params: Promise.resolve({ locationKey: code }),
});

describe("GET /api/municipal-report/[locationKey]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.mockResolvedValue(null);
  });

  it("requires authentication", async () => {
    auth.mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));
    const response = await GET(
      new Request("https://test/api/municipal-report/5200050?period=2024"),
      context("5200050"),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(build).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid", "2024"],
    ["5200050", ""],
    ["5200050", "2024-13"],
  ])("returns 400 for invalid input", async (code, period) => {
    const response = await GET(
      new Request(`https://test/api/municipal-report/${code}?period=${period}`),
      context(code),
    );
    expect(response.status).toBe(400);
  });

  it("returns a cached report when at least one analysis is available", async () => {
    build.mockResolvedValueOnce({
      analyses: [{ status: "available" }],
    } as never);
    const response = await GET(
      new Request("https://test/api/municipal-report/5200050?period=2024"),
      context("5200050"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=600");
  });

  // Regressão: o nome da camada vai para o `Server-Timing`, e um travessão
  // (U+2014) não cabe num cabeçalho HTTP. Um índice publicado pelo catálogo com
  // travessão no nome fazia esta rota responder 502 com o relatório já montado —
  // e só na primeira requisição, porque o relatório em cache não regrava os
  // tempos por análise.
  it("returns 200 when a layer name carries a character outside Latin-1", async () => {
    build.mockImplementationOnce(async (_code, _period, dependencies) => {
      dependencies?.onTiming?.(
        "analysis_teste",
        1,
        "Previsão: Anomalia — CPTEC INPE",
      );
      return { analyses: [{ status: "available" }] } as never;
    });
    const response = await GET(
      new Request("https://test/api/municipal-report/5200050?period=2024"),
      context("5200050"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Server-Timing")).toContain(
      'desc="Previsao: Anomalia CPTEC INPE"',
    );
  });

  it("returns 502 when no analysis can be built", async () => {
    build.mockResolvedValueOnce({
      analyses: [{ status: "unavailable" }],
    } as never);
    const response = await GET(
      new Request("https://test/api/municipal-report/5200050?period=2024"),
      context("5200050"),
    );
    expect(response.status).toBe(502);
  });

  it("returns 200 with history when the requested period is not found", async () => {
    build.mockResolvedValueOnce({
      analyses: [
        { status: "period_not_found", timeSeries: [{ period: "2023" }] },
      ],
    } as never);
    const response = await GET(
      new Request("https://test/api/municipal-report/5200050?period=2024"),
      context("5200050"),
    );
    expect(response.status).toBe(200);
  });

  it.each(["br", "pb", "3_bioma-caatinga"])(
    "aceita a chave territorial %s",
    async (key) => {
      build.mockResolvedValueOnce({
        analyses: [{ status: "available" }],
      } as never);
      const response = await GET(
        new Request(`https://test/api/municipal-report/${key}?period=2024`),
        context(key),
      );
      expect(response.status).toBe(200);
      expect(build).toHaveBeenCalledWith(key, "2024", expect.anything());
    },
  );

  it("returns 404 for an unknown municipality", async () => {
    build.mockRejectedValueOnce(
      new MunicipalReportNotFoundError("Municipality not found."),
    );
    const response = await GET(
      new Request("https://test/api/municipal-report/9999999?period=2024"),
      context("9999999"),
    );
    expect(response.status).toBe(404);
  });
});
