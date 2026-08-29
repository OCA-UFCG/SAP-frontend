import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCachedMunicipalAnalysisImageDataMock,
  getMunicipalAnalysisCacheControlHeaderMock,
  getAuthenticatedUserIdMock,
} = vi.hoisted(() => ({
  getCachedMunicipalAnalysisImageDataMock: vi.fn(),
  getMunicipalAnalysisCacheControlHeaderMock: vi.fn(),
  getAuthenticatedUserIdMock: vi.fn(),
}));

vi.mock("@/lib/server-session", () => ({
  getAuthenticatedUserId: getAuthenticatedUserIdMock,
}));

vi.mock("@/repositories/platform/municipalAnalysisCache", () => ({
  getCachedMunicipalAnalysisImageData: getCachedMunicipalAnalysisImageDataMock,
  getMunicipalAnalysisCacheControlHeader:
    getMunicipalAnalysisCacheControlHeaderMock,
}));

import { GET } from "@/app/api/municipal-analysis/[panelLayerId]/route";
import { clearMunicipalAnalysisRateLimit } from "@/app/api/municipal-analysis/rate-limit";

const callMunicipalAnalysisRoute = (
  panelLayerId: string,
  yearKey?: string,
  locationKey?: string,
) => {
  const url = new URL(
    `https://example.test/api/municipal-analysis/${panelLayerId}`,
  );
  if (yearKey) url.searchParams.set("year", yearKey);
  if (locationKey) url.searchParams.set("locationKey", locationKey);

  return GET(new Request(url), {
    params: Promise.resolve({ panelLayerId }),
  });
};

describe("municipal analysis route", () => {
  beforeEach(() => {
    getCachedMunicipalAnalysisImageDataMock.mockReset();
    getMunicipalAnalysisCacheControlHeaderMock.mockReset();
    getAuthenticatedUserIdMock.mockReset();
    getAuthenticatedUserIdMock.mockResolvedValue("user-1");
    clearMunicipalAnalysisRateLimit();
    getMunicipalAnalysisCacheControlHeaderMock.mockReturnValue(
      "private, max-age=600, stale-while-revalidate=3600",
    );
  });

  it("rejects unauthenticated requests without loading municipal analysis", async () => {
    getAuthenticatedUserIdMock.mockResolvedValue(null);

    const response = await callMunicipalAnalysisRoute("CDI_Test", "2026");

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(getCachedMunicipalAnalysisImageDataMock).not.toHaveBeenCalled();
  });

  it("returns cached imageData with cache-control headers", async () => {
    getCachedMunicipalAnalysisImageDataMock.mockResolvedValue({
      found: true,
      imageData: { type: "territorial-compact" },
      status: "hit",
    });

    const response = await callMunicipalAnalysisRoute("CDI_Test", "2026");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "private, max-age=600, stale-while-revalidate=3600",
    );
    await expect(response.json()).resolves.toEqual({
      imageData: { type: "territorial-compact" },
    });
    expect(getCachedMunicipalAnalysisImageDataMock).toHaveBeenCalledWith(
      "CDI_Test",
      "2026",
    );
  });

  it("keeps the legacy full-layer request when year is omitted", async () => {
    getCachedMunicipalAnalysisImageDataMock.mockResolvedValue({
      found: true,
      imageData: { type: "territorial-compact" },
      status: "miss",
    });

    const response = await callMunicipalAnalysisRoute("CDI_Test");

    expect(response.status).toBe(200);
    expect(getCachedMunicipalAnalysisImageDataMock).toHaveBeenCalledWith(
      "CDI_Test",
      undefined,
    );
  });

  it("loads a location-specific GEE statistics slice", async () => {
    getCachedMunicipalAnalysisImageDataMock.mockResolvedValue({
      found: true,
      imageData: { type: "territorial-compact" },
      status: "miss",
    });

    const response = await callMunicipalAnalysisRoute(
      "carbonoembrapa",
      "2020-01",
      "2507507",
    );

    expect(response.status).toBe(200);
    expect(getCachedMunicipalAnalysisImageDataMock).toHaveBeenCalledWith(
      "carbonoembrapa",
      "2020-01",
      "2507507",
    );
  });

  it("rejects invalid panel layer ids before cache access", async () => {
    const response = await callMunicipalAnalysisRoute("../secret", "2026");

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Invalid panel layer id.",
    });
    expect(getCachedMunicipalAnalysisImageDataMock).not.toHaveBeenCalled();
  });

  it("rejects invalid years before cache access", async () => {
    const response = await callMunicipalAnalysisRoute("CDI_Test", "2026-13");

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Invalid year.",
    });
    expect(getCachedMunicipalAnalysisImageDataMock).not.toHaveBeenCalled();
  });

  it("rejects invalid location keys before cache access", async () => {
    const response = await callMunicipalAnalysisRoute(
      "carbonoembrapa",
      "2020-01",
      "../secret",
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid location key.",
    });
    expect(getCachedMunicipalAnalysisImageDataMock).not.toHaveBeenCalled();
  });

  it("requires a year for location-specific requests", async () => {
    const response = await callMunicipalAnalysisRoute(
      "carbonoembrapa",
      undefined,
      "br",
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "A year is required when locationKey is provided.",
    });
    expect(getCachedMunicipalAnalysisImageDataMock).not.toHaveBeenCalled();
  });

  it("keeps missing panel layers as 404 responses", async () => {
    getCachedMunicipalAnalysisImageDataMock.mockResolvedValue({
      found: false,
      imageData: null,
      status: "miss",
    });

    const response = await callMunicipalAnalysisRoute("missing-layer");

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Panel layer not found.",
    });
  });

  it("returns a controlled 502 when municipal analysis loading fails", async () => {
    getCachedMunicipalAnalysisImageDataMock.mockRejectedValue(
      new Error("Contentful unavailable"),
    );

    const response = await callMunicipalAnalysisRoute("CDI_Test", "2026");

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Unable to load municipal analysis.",
    });
  });

  // Esta rota é a que mais gera trabalho no Earth Engine, e a fila do SDK é uma
  // só por processo: sem teto, um cliente descontrolado atrasa o mapa de todos
  // os outros usuários daquela instância.
  it("barra o usuário que passa do teto da janela, sem tocar no Earth Engine", async () => {
    vi.stubEnv("MUNICIPAL_ANALYSIS_RATE_LIMIT_MAX_REQUESTS", "2");
    getCachedMunicipalAnalysisImageDataMock.mockResolvedValue({
      found: true,
      imageData: { type: "territorial-compact" },
      status: "hit",
    });

    await callMunicipalAnalysisRoute("CDI_Test", "2026");
    await callMunicipalAnalysisRoute("CDI_Test", "2025");
    getCachedMunicipalAnalysisImageDataMock.mockClear();
    const response = await callMunicipalAnalysisRoute("CDI_Test", "2024");

    expect(response.status).toBe(429);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(getCachedMunicipalAnalysisImageDataMock).not.toHaveBeenCalled();
  });

  it("não gasta cota de quem nem chegou a se autenticar", async () => {
    vi.stubEnv("MUNICIPAL_ANALYSIS_RATE_LIMIT_MAX_REQUESTS", "1");
    getAuthenticatedUserIdMock.mockResolvedValue(null);

    await callMunicipalAnalysisRoute("CDI_Test", "2026");
    getAuthenticatedUserIdMock.mockResolvedValue("user-1");
    getCachedMunicipalAnalysisImageDataMock.mockResolvedValue({
      found: true,
      imageData: { type: "territorial-compact" },
      status: "hit",
    });

    const response = await callMunicipalAnalysisRoute("CDI_Test", "2026");

    expect(response.status).toBe(200);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});
