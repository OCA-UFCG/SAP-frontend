import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCachedMunicipalAnalysisImageDataMock,
  getMunicipalAnalysisCacheControlHeaderMock,
} = vi.hoisted(() => ({
  getCachedMunicipalAnalysisImageDataMock: vi.fn(),
  getMunicipalAnalysisCacheControlHeaderMock: vi.fn(),
}));

vi.mock("@/repositories/platform/municipalAnalysisCache", () => ({
  getCachedMunicipalAnalysisImageData: getCachedMunicipalAnalysisImageDataMock,
  getMunicipalAnalysisCacheControlHeader:
    getMunicipalAnalysisCacheControlHeaderMock,
}));

import { GET } from "@/app/api/municipal-analysis/[panelLayerId]/route";

const callMunicipalAnalysisRoute = (panelLayerId: string, yearKey?: string) =>
  GET(
    new Request(
      `https://example.test/api/municipal-analysis/${panelLayerId}${yearKey ? `?year=${yearKey}` : ""}`,
    ),
    {
      params: Promise.resolve({ panelLayerId }),
    },
  );

describe("municipal analysis route", () => {
  beforeEach(() => {
    getCachedMunicipalAnalysisImageDataMock.mockReset();
    getMunicipalAnalysisCacheControlHeaderMock.mockReset();
    getMunicipalAnalysisCacheControlHeaderMock.mockReturnValue(
      "public, max-age=600, stale-while-revalidate=3600",
    );
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
      "public, max-age=600, stale-while-revalidate=3600",
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
});
