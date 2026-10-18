import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getGeeStatisticsSeriesPatchMock,
  getMunicipalAnalysisCacheControlHeaderMock,
  getMunicipalReportSeriesMock,
  getPanelLayerByIdMock,
  requireAuthenticatedRequestMock,
} = vi.hoisted(() => ({
  getGeeStatisticsSeriesPatchMock: vi.fn(),
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

vi.mock("@/repositories/platform/geeStatisticsRepository", () => ({
  getGeeStatisticsSeriesPatch: getGeeStatisticsSeriesPatchMock,
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

const dekadSource = {
  kind: "gee-feature-collection" as const,
  asset: {
    type: "period-template" as const,
    assetIdTemplate: "projects/x/Estatistica_CDI_{year}",
  },
  periodGranularity: "dekad" as const,
  properties: {},
  schemaVersion: 1 as const,
  sourceRevision: "rev-1",
};

const dekadLayer = {
  reportSeriesConfig: null,
  statisticsSource: dekadSource,
  imageData: {
    schemaVersion: 1,
    type: "territorial-compact",
    classes: [
      { id: "1", label: "A", color: "#000" },
      { id: "2", label: "B", color: "#fff" },
    ],
    years: {
      "2026-09-11": { imageId: "img", values: {} },
      "2001-01-01": { imageId: "img", values: {} },
    },
  },
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
    getGeeStatisticsSeriesPatchMock.mockReset();
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

  it("rejects invalid location keys before Contentful access", async () => {
    const response = await callRoute("layer-1", "../pb");

    expect(response.status).toBe(400);
    expect(getPanelLayerByIdMock).not.toHaveBeenCalled();
    expect(getMunicipalReportSeriesMock).not.toHaveBeenCalled();
  });

  it("serves the pre-built report series to municipalities only", async () => {
    const response = await callRoute("layer-1", "pb");

    expect(response.status).toBe(400);
    expect(getMunicipalReportSeriesMock).not.toHaveBeenCalled();
  });

  it("reads the whole Earth Engine series of any territory in one request", async () => {
    getPanelLayerByIdMock.mockResolvedValue(dekadLayer);
    const patch = {
      schemaVersion: 1,
      type: "territorial-compact",
      years: { "2001-01-01": { valuesScale: 1, values: { pb: [40, 60] } } },
    };
    getGeeStatisticsSeriesPatchMock.mockResolvedValue(patch);

    const response = await callRoute("cdi", "pb");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ imageData: patch });
    expect(getGeeStatisticsSeriesPatchMock).toHaveBeenCalledWith(
      "cdi",
      "pb",
      2,
      dekadSource,
      ["2001-01-01", "2026-09-11"],
    );
    expect(getMunicipalReportSeriesMock).not.toHaveBeenCalled();
  });

  it("returns 404 for a spreadsheet source, which has no Earth Engine series", async () => {
    getPanelLayerByIdMock.mockResolvedValue({
      ...dekadLayer,
      statisticsSource: { kind: "municipal-spreadsheet" },
    });

    const response = await callRoute("planilha", "br");

    expect(response.status).toBe(404);
    expect(getGeeStatisticsSeriesPatchMock).not.toHaveBeenCalled();
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
