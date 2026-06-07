import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCachedMunicipalAnalysisImageDataMock,
  getMunicipalAnalysisCacheControlHeaderMock,
  requireAuthenticatedRequestMock,
} = vi.hoisted(() => ({
  getCachedMunicipalAnalysisImageDataMock: vi.fn(),
  getMunicipalAnalysisCacheControlHeaderMock: vi.fn(),
  requireAuthenticatedRequestMock: vi.fn(),
}));

vi.mock("@/lib/server-session", () => ({
  requireAuthenticatedRequest: requireAuthenticatedRequestMock,
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
    requireAuthenticatedRequestMock.mockReset();
    requireAuthenticatedRequestMock.mockResolvedValue(null);
    getMunicipalAnalysisCacheControlHeaderMock.mockReturnValue(
      "private, max-age=600, stale-while-revalidate=3600",
    );
  });

  it("rejects unauthenticated requests without loading municipal analysis", async () => {
    requireAuthenticatedRequestMock.mockResolvedValue(
      Response.json({ error: "Unauthorized access." }, { status: 401 }),
    );

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
});
