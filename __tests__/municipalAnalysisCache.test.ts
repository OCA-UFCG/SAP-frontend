import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayerWithMunicipalAnalysis: vi.fn(),
}));

import { getPanelLayerWithMunicipalAnalysis } from "@/repositories/platform/panelLayerRepository";
import {
  clearMunicipalAnalysisCacheForTests,
  getCachedMunicipalAnalysisImageData,
  getMunicipalAnalysisCacheControlHeader,
} from "@/repositories/platform/municipalAnalysisCache";
import type { PanelLayerI } from "@/utils/interfaces";

const mockedGetPanelLayerWithMunicipalAnalysis = vi.mocked(
  getPanelLayerWithMunicipalAnalysis,
);

function buildLayer(
  id: string,
  values: Record<string, number[]> = {},
): PanelLayerI {
  return {
    sys: { id: `sys-${id}` },
    id,
    name: id,
    description: "",
    previewMap: { url: "/preview.png" },
    imageData: {
      schemaVersion: 1,
      type: "territorial-compact",
      classes: [],
      years: {
        "2026": {
          imageId: `img-${id}`,
          values,
        },
      },
    },
  };
}

describe("municipalAnalysisCache", () => {
  const originalTtl = process.env.MUNICIPAL_ANALYSIS_CACHE_TTL_SECONDS;
  const originalMaxEntries = process.env.MUNICIPAL_ANALYSIS_CACHE_MAX_ENTRIES;

  beforeEach(() => {
    clearMunicipalAnalysisCacheForTests();
    mockedGetPanelLayerWithMunicipalAnalysis.mockReset();
    delete process.env.MUNICIPAL_ANALYSIS_CACHE_TTL_SECONDS;
    delete process.env.MUNICIPAL_ANALYSIS_CACHE_MAX_ENTRIES;
  });

  afterEach(() => {
    clearMunicipalAnalysisCacheForTests();
    vi.useRealTimers();

    if (originalTtl === undefined) {
      delete process.env.MUNICIPAL_ANALYSIS_CACHE_TTL_SECONDS;
    } else {
      process.env.MUNICIPAL_ANALYSIS_CACHE_TTL_SECONDS = originalTtl;
    }

    if (originalMaxEntries === undefined) {
      delete process.env.MUNICIPAL_ANALYSIS_CACHE_MAX_ENTRIES;
    } else {
      process.env.MUNICIPAL_ANALYSIS_CACHE_MAX_ENTRIES = originalMaxEntries;
    }
  });

  it("reuses cached municipal analysis for repeated panel layer requests", async () => {
    mockedGetPanelLayerWithMunicipalAnalysis.mockResolvedValue(
      buildLayer("CDI_Test"),
    );

    const first = await getCachedMunicipalAnalysisImageData("CDI_Test");
    const second = await getCachedMunicipalAnalysisImageData("CDI_Test");

    expect(first.status).toBe("miss");
    expect(second.status).toBe("hit");
    expect(first.imageData).toBe(second.imageData);
    expect(mockedGetPanelLayerWithMunicipalAnalysis).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent requests for the same panel layer", async () => {
    let resolveLayer: (value: ReturnType<typeof buildLayer>) => void = () => {};
    mockedGetPanelLayerWithMunicipalAnalysis.mockReturnValue(
      new Promise((resolve) => {
        resolveLayer = resolve;
      }),
    );

    const first = getCachedMunicipalAnalysisImageData("CDI_Test");
    const second = getCachedMunicipalAnalysisImageData("CDI_Test");

    resolveLayer(buildLayer("CDI_Test"));

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult.status).toBe("miss");
    expect(secondResult.status).toBe("deduped");
    expect(mockedGetPanelLayerWithMunicipalAnalysis).toHaveBeenCalledTimes(1);
  });

  it("refreshes municipal analysis after the configured TTL expires", async () => {
    vi.useFakeTimers();
    process.env.MUNICIPAL_ANALYSIS_CACHE_TTL_SECONDS = "1";
    mockedGetPanelLayerWithMunicipalAnalysis
      .mockResolvedValueOnce(buildLayer("CDI_Test", { br: [10, 90] }))
      .mockResolvedValueOnce(buildLayer("CDI_Test", { br: [20, 80] }));

    const first = await getCachedMunicipalAnalysisImageData("CDI_Test");
    vi.advanceTimersByTime(1001);
    const second = await getCachedMunicipalAnalysisImageData("CDI_Test");

    expect(first.status).toBe("miss");
    expect(second.status).toBe("miss");
    expect(mockedGetPanelLayerWithMunicipalAnalysis).toHaveBeenCalledTimes(2);
    expect(first.imageData).not.toBe(second.imageData);
  });

  it("keeps separate cache entries per panel layer", async () => {
    mockedGetPanelLayerWithMunicipalAnalysis.mockImplementation(async (id) =>
      buildLayer(id),
    );

    const cdi = await getCachedMunicipalAnalysisImageData("CDI_Test");
    const ana = await getCachedMunicipalAnalysisImageData("anaseca");

    expect(cdi.status).toBe("miss");
    expect(ana.status).toBe("miss");
    expect(mockedGetPanelLayerWithMunicipalAnalysis).toHaveBeenCalledTimes(2);
    expect(mockedGetPanelLayerWithMunicipalAnalysis).toHaveBeenCalledWith(
      "CDI_Test",
    );
    expect(mockedGetPanelLayerWithMunicipalAnalysis).toHaveBeenCalledWith(
      "anaseca",
    );
  });

  it("evicts the least recently used entry when the cache reaches its limit", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    process.env.MUNICIPAL_ANALYSIS_CACHE_MAX_ENTRIES = "2";
    mockedGetPanelLayerWithMunicipalAnalysis.mockImplementation(async (id) =>
      buildLayer(id),
    );

    await getCachedMunicipalAnalysisImageData("CDI_Test");
    vi.advanceTimersByTime(1);
    await getCachedMunicipalAnalysisImageData("anaseca");
    vi.advanceTimersByTime(1);
    await getCachedMunicipalAnalysisImageData("CDI_Test");
    vi.advanceTimersByTime(1);
    await getCachedMunicipalAnalysisImageData("terraibge");
    vi.advanceTimersByTime(1);
    const ana = await getCachedMunicipalAnalysisImageData("anaseca");

    expect(ana.status).toBe("miss");
    expect(mockedGetPanelLayerWithMunicipalAnalysis).toHaveBeenCalledTimes(4);
    expect(mockedGetPanelLayerWithMunicipalAnalysis).toHaveBeenNthCalledWith(
      4,
      "anaseca",
    );
  });

  it("does not cache failed municipal analysis loads", async () => {
    mockedGetPanelLayerWithMunicipalAnalysis
      .mockRejectedValueOnce(new Error("Contentful unavailable"))
      .mockResolvedValueOnce(buildLayer("CDI_Test"));

    await expect(
      getCachedMunicipalAnalysisImageData("CDI_Test"),
    ).rejects.toThrow("Contentful unavailable");

    const retry = await getCachedMunicipalAnalysisImageData("CDI_Test");

    expect(retry.status).toBe("miss");
    expect(retry.found).toBe(true);
    expect(mockedGetPanelLayerWithMunicipalAnalysis).toHaveBeenCalledTimes(2);
  });

  it("exposes cache control based on the configured TTL", () => {
    process.env.MUNICIPAL_ANALYSIS_CACHE_TTL_SECONDS = "120";

    expect(getMunicipalAnalysisCacheControlHeader()).toBe(
      "public, max-age=120, stale-while-revalidate=3600",
    );
  });
});
