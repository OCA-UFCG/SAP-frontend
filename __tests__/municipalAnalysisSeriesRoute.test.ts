import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getMunicipalAnalysisCacheControlHeaderMock,
  getMunicipalReportSeriesMock,
  getPanelLayerByIdMock,
  requireAuthenticatedRequestMock,
} = vi.hoisted(() => ({
  getMunicipalAnalysisCacheControlHeaderMock: vi.fn(),
  getMunicipalReportSeriesMock: vi.fn(),
  getPanelLayerByIdMock: vi.fn(),
  requireAuthenticatedRequestMock: vi.fn(),
}));

vi.mock("@/lib/server-session", () => ({
  requireAuthenticatedRequest: requireAuthenticatedRequestMock,
}));

vi.mock("@/repositories/platform/municipalAnalysisCache", () => ({
  getMunicipalAnalysisCacheControlHeader:
    getMunicipalAnalysisCacheControlHeaderMock,
}));

vi.mock("@/repositories/platform/municipalReportSeriesRepository", async () => {
  const actual = await vi.importActual<
    typeof import("@/repositories/platform/municipalReportSeriesRepository")
  >("@/repositories/platform/municipalReportSeriesRepository");

  return {
    ...actual,
    getMunicipalReportSeries: getMunicipalReportSeriesMock,
  };
});

vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayerById: getPanelLayerByIdMock,
}));

import { GET } from "@/app/api/municipal-analysis/[panelLayerId]/series/route";

const reportSeriesConfig = {
  schemaVersion: 1 as const,
  datasetVersion: "v1",
  shardCount: 64,
  shardStrategy: "ibge-modulo" as const,
  firstPeriod: "2023",
  lastPeriod: "2024",
};

function callRoute(panelLayerId: string, locationKey?: string) {
  const params = new URLSearchParams();
  if (locationKey) params.set("locationKey", locationKey);

  return GET(
    new Request(
      `https://example.test/api/municipal-analysis/${panelLayerId}/series?${params}`,
    ),
    { params: Promise.resolve({ panelLayerId }) },
  );
}

describe("municipal analysis series route", () => {
  beforeEach(() => {
    requireAuthenticatedRequestMock.mockReset();
    getPanelLayerByIdMock.mockReset();
    getMunicipalReportSeriesMock.mockReset();
    getMunicipalAnalysisCacheControlHeaderMock.mockReset();
    requireAuthenticatedRequestMock.mockResolvedValue(null);
    getMunicipalAnalysisCacheControlHeaderMock.mockReturnValue(
      "private, max-age=600, stale-while-revalidate=3600",
    );
    getPanelLayerByIdMock.mockResolvedValue({ reportSeriesConfig });
  });

  it("returns the selected municipality history as a compact patch", async () => {
    getMunicipalReportSeriesMock.mockResolvedValue({
      municipality: {
        "2023": { values: [10, 90], valuesScale: 1 },
        "2024": { values: [20, 80], valuesScale: 1 },
      },
      aggregate: null,
    });

    const response = await callRoute("layer-1", "5200050");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "private, max-age=600, stale-while-revalidate=3600",
    );
    await expect(response.json()).resolves.toEqual({
      imageData: {
        schemaVersion: 1,
        type: "territorial-compact",
        years: {
          "2023": {
            valuesScale: 1,
            values: { "5200050": [10, 90] },
          },
          "2024": {
            valuesScale: 1,
            values: { "5200050": [20, 80] },
          },
        },
      },
    });
    expect(getMunicipalReportSeriesMock).toHaveBeenCalledWith(
      "layer-1",
      "5200050",
      reportSeriesConfig,
    );
  });

  it("rejects invalid municipality codes before Contentful access", async () => {
    const response = await callRoute("layer-1", "pb");

    expect(response.status).toBe(400);
    expect(getPanelLayerByIdMock).not.toHaveBeenCalled();
    expect(getMunicipalReportSeriesMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the layer has no active report series", async () => {
    getPanelLayerByIdMock.mockResolvedValue({ reportSeriesConfig: null });

    const response = await callRoute("layer-1", "5200050");

    expect(response.status).toBe(404);
    expect(getMunicipalReportSeriesMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests", async () => {
    requireAuthenticatedRequestMock.mockResolvedValue(
      Response.json({ error: "Unauthorized access." }, { status: 401 }),
    );

    const response = await callRoute("layer-1", "5200050");

    expect(response.status).toBe(401);
    expect(getPanelLayerByIdMock).not.toHaveBeenCalled();
  });
});
