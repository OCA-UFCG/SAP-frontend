import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/telemetry/client", () => ({
  trackUiEvent: vi.fn(),
}));

vi.mock("@/data/municipalAvailabilityIndex.json", () => ({
  default: {
    schemaVersion: 1,
    generatedAt: "2026-01-01T00:00:00.000Z",
    layers: [
      {
        panelLayerId: "layer-1",
        order: 0,
        periods: ["2010", "2020", "2024"],
      },
    ],
    byMunicipality: {
      "5200050": {
        "layer-1": "0-2",
      },
    },
  },
}));

import citiesIndex from "@/data/citiesIndex.json";
import { AnalysisContext } from "@/components/SidePanelContexts/AnalysisContext";
import { trackUiEvent } from "@/services/telemetry/client";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";
import type { PanelLayerI } from "@/utils/interfaces";

const useMapLayerActiveStateMock = vi.fn();
const useMapLayerViewStateMock = vi.fn();
const useMapLayerActionsMock = vi.fn();
const analysisPanelMock = vi.fn();

vi.mock("@/components/MapLayerContext/MapLayerContext", () => ({
  useMapLayerActiveState: () => useMapLayerActiveStateMock(),
  useMapLayerViewState: () => useMapLayerViewStateMock(),
  useMapLayerActions: () => useMapLayerActionsMock(),
}));

vi.mock("@/components/analysis/AnalysisPanel", () => ({
  AnalysisPanel: (props: Record<string, unknown>) => {
    analysisPanelMock(props);
    return <div data-testid="analysis-panel-probe" />;
  },
}));

const municipality = citiesIndex[0];

function buildPanelLayer(
  values: Record<string, number[]>,
  years: CompactTerritorialAnalysisDataset["years"] = {
    "2024": {
      imageId: "img-2024",
      valuesScale: 1,
      values,
    },
  },
  locations: Record<string, string> = {},
): PanelLayerI {
  return {
    sys: { id: "sys-layer-1" },
    id: "layer-1",
    name: "Camada de teste",
    description: "",
    previewMap: { url: "/preview.png" },
    imageData: {
      schemaVersion: 1,
      type: "territorial-compact",
      defaultYear: "2024",
      classes: [
        { id: "a", label: "Classe A", color: "#111111" },
        { id: "b", label: "Classe B", color: "#222222" },
      ],
      locations: {
        br: "Brasil",
        [municipality.uf]: municipality.uf.toUpperCase(),
        ...locations,
      },
      years,
    },
  };
}

function withReportSeries(panelLayer: PanelLayerI): PanelLayerI {
  return {
    ...panelLayer,
    reportSeriesConfig: {
      schemaVersion: 1,
      datasetVersion: "v1",
      shardCount: 64,
      shardStrategy: "ibge-modulo",
      firstPeriod: "2010",
      lastPeriod: "2024",
    },
  };
}

describe("AnalysisContext", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    analysisPanelMock.mockReset();
    useMapLayerActiveStateMock.mockReset();
    useMapLayerViewStateMock.mockReset();
    useMapLayerActionsMock.mockReset();

    useMapLayerActiveStateMock.mockReturnValue({
      activeLayerId: "layer-1",
    });

    useMapLayerViewStateMock.mockReturnValue({
      selectedState: municipality.uf,
      selectedMunicipalityCode: municipality.code,
      activeYear: "2024",
      spatialSelection: {
        spatialArea: "national",
        spatialValue: "brasil",
      },
    });

    useMapLayerActionsMock.mockReturnValue({
      setSelectedState: vi.fn(),
      setSelectedMunicipalityCode: vi.fn(),
      setActiveLegend: vi.fn(),
      setActiveYear: vi.fn(),
      resetPlatformState: vi.fn(),
      setSpatialSelection: vi.fn(),
    });

    vi.mocked(trackUiEvent).mockReset();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ imageData: null }),
    } as Response);
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
  });

  it("passes the selected municipality code through to the analysis panel", () => {
    render(
      <AnalysisContext
        activeSection="analysis-detail"
        panelLayers={[
          buildPanelLayer({
            br: [45, 55],
            [municipality.uf]: [35, 65],
            [municipality.code]: [80, 20],
          }),
        ]}
      />,
    );

    expect(analysisPanelMock).toHaveBeenCalled();

    const props = analysisPanelMock.mock.calls.at(-1)?.[0] as {
      model: { name: string } | null;
      selectedState: string;
    };

    expect(props.selectedState).toBe(municipality.code);
    expect(props.model?.name).toBe(municipality.label);
  });

  it("uses the municipality label in the empty state when the module has no municipal data", () => {
    render(
      <AnalysisContext
        activeSection="analysis-detail"
        panelLayers={[
          buildPanelLayer({
            br: [45, 55],
            [municipality.uf]: [35, 65],
          }),
        ]}
      />,
    );

    const props = analysisPanelMock.mock.calls.at(-1)?.[0] as {
      emptyStateTitle: string;
      model: unknown;
      selectedState: string;
    };

    expect(props.selectedState).toBe(municipality.code);
    expect(props.model).toBeNull();
    expect(props.emptyStateTitle).toContain(municipality.label);
  });

  it("shows the canonical ASD + Entorno data instead of Apenas ASD", () => {
    useMapLayerViewStateMock.mockReturnValue({
      selectedState: "br",
      selectedMunicipalityCode: null,
      activeYear: "2024",
      spatialSelection: {
        spatialArea: "asd",
        spatialValue: "ASD",
      },
    });

    render(
      <AnalysisContext
        activeSection="analysis-detail"
        panelLayers={[
          buildPanelLayer(
            {
              br: [45, 55],
              "4_asd-apenas-asd": [90, 10],
              "4_asd-asd-entorno": [20, 80],
            },
            undefined,
            {
              "4_asd-apenas-asd": "Apenas ASD",
              "4_asd-asd-entorno": "ASD + Entorno",
            },
          ),
        ]}
      />,
    );

    const props = analysisPanelMock.mock.calls.at(-1)?.[0] as {
      model: {
        name: string;
        distribution: Array<{ id: string; value: number }>;
      } | null;
      selectedState: string;
    };

    expect(props.selectedState).toBe("4_asd-asd-entorno");
    expect(props.model?.name).toBe("ASD + Entorno");
    expect(props.model?.distribution[0]).toMatchObject({ value: 20 });
  });

  it("names an unavailable semiarid scope from the canonical contract", () => {
    useMapLayerViewStateMock.mockReturnValue({
      selectedState: "br",
      selectedMunicipalityCode: null,
      activeYear: "2024",
      spatialSelection: {
        spatialArea: "semiarid",
        spatialValue: "semiárido",
      },
    });

    render(
      <AnalysisContext
        activeSection="analysis-detail"
        panelLayers={[
          buildPanelLayer({
            br: [45, 55],
          }),
        ]}
      />,
    );

    const props = analysisPanelMock.mock.calls.at(-1)?.[0] as {
      emptyStateTitle: string;
      model: unknown;
      selectedState: string;
    };

    expect(props.selectedState).toBe("5_semiarido-semiarido-total");
    expect(props.model).toBeNull();
    expect(props.emptyStateTitle).toContain("Semiárido Total");
  });

  it("clears a previous municipality when the spatial scope changes", () => {
    render(
      <AnalysisContext
        activeSection="analysis-detail"
        panelLayers={[
          buildPanelLayer({
            br: [45, 55],
            [municipality.uf]: [35, 65],
          }),
        ]}
      />,
    );

    const props = analysisPanelMock.mock.calls.at(-1)?.[0] as {
      onSpatialSelectionChange: (value: {
        spatialArea: "biome";
        spatialValue: "Caatinga";
      }) => void;
    };

    props.onSpatialSelectionChange({
      spatialArea: "biome",
      spatialValue: "Caatinga",
    });

    const actions = useMapLayerActionsMock.mock.results.at(-1)?.value as {
      setSelectedMunicipalityCode: ReturnType<typeof vi.fn>;
      setSelectedState: ReturnType<typeof vi.fn>;
      setSpatialSelection: ReturnType<typeof vi.fn>;
    };

    expect(actions.setSpatialSelection).toHaveBeenCalledWith({
      spatialArea: "biome",
      spatialValue: "Caatinga",
    });
    expect(actions.setSelectedState).toHaveBeenCalledWith("br");
    expect(actions.setSelectedMunicipalityCode).toHaveBeenCalledWith(null);
  });

  it("tracks resolved municipality searches for the active layer", () => {
    render(
      <AnalysisContext
        activeSection="analysis-detail"
        panelLayers={[
          buildPanelLayer({
            br: [45, 55],
            [municipality.uf]: [35, 65],
            [municipality.code]: [80, 20],
          }),
        ]}
      />,
    );

    const props = analysisPanelMock.mock.calls.at(-1)?.[0] as {
      onSearch: (
        value: string,
        metadata: { selectionMethod: "option-click"; visibleOptionCount: 1 },
      ) => void;
    };

    props.onSearch(municipality.label, {
      selectionMethod: "option-click",
      visibleOptionCount: 1,
    });

    const actions = useMapLayerActionsMock.mock.results.at(-1)?.value as {
      setSelectedState: ReturnType<typeof vi.fn>;
      setSelectedMunicipalityCode: ReturnType<typeof vi.fn>;
    };

    expect(actions.setSelectedState).toHaveBeenCalledWith(municipality.uf);
    expect(actions.setSelectedMunicipalityCode).toHaveBeenCalledWith(
      municipality.code,
    );
    expect(trackUiEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "search_found",
        surface: "analysis-panel",
        query: municipality.label,
        resolvedLocationType: "city",
        resolvedStateKey: municipality.uf,
        resolvedMunicipalityCode: municipality.code,
        activeLayerId: "layer-1",
        activeDateLabel: "2024",
      }),
    );
  });

  it("tracks municipality searches as not found when the active layer has no municipal data", () => {
    render(
      <AnalysisContext
        activeSection="analysis-detail"
        panelLayers={[
          buildPanelLayer({
            br: [45, 55],
            [municipality.uf]: [35, 65],
          }),
        ]}
      />,
    );

    const props = analysisPanelMock.mock.calls.at(-1)?.[0] as {
      onSearch: (
        value: string,
        metadata: { selectionMethod: "button"; visibleOptionCount: 0 },
      ) => void;
    };

    props.onSearch(municipality.label, {
      selectionMethod: "button",
      visibleOptionCount: 0,
    });

    expect(trackUiEvent).toHaveBeenCalledTimes(1);
    expect(trackUiEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "search_not_found",
        surface: "analysis-panel",
        query: municipality.label,
        resolvedLocationType: "city",
        resolvedMunicipalityCode: municipality.code,
        activeLayerId: "layer-1",
        activeDateLabel: "2024",
      }),
    );
  });

  it("fetches the active period and the complete municipal series separately", async () => {
    useMapLayerViewStateMock.mockReturnValue({
      selectedState: municipality.uf,
      selectedMunicipalityCode: municipality.code,
      activeYear: "general",
      spatialSelection: {
        spatialArea: "national",
        spatialValue: "brasil",
      },
    });

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const requestUrl = new URL(url);

      return {
        ok: true,
        json: async () => ({
          imageData: requestUrl.pathname.endsWith("/series")
            ? {
                schemaVersion: 1,
                type: "territorial-compact",
                years: {
                  "2010": {
                    valuesScale: 1,
                    values: { [municipality.code]: [10, 90] },
                  },
                  "2020": {
                    valuesScale: 1,
                    values: { [municipality.code]: [20, 80] },
                  },
                  "2024": {
                    valuesScale: 1,
                    values: { [municipality.code]: [30, 70] },
                  },
                },
              }
            : null,
        }),
      } as Response;
    });

    render(
      <AnalysisContext
        activeSection="analysis-detail"
        panelLayers={[
          withReportSeries(
            buildPanelLayer(
              {
                br: [45, 55],
                [municipality.uf]: [35, 65],
              },
              {
                "2010": {
                  imageId: "img-2010",
                  valuesScale: 1,
                  values: { br: [45, 55] },
                },
                "2020": {
                  imageId: "img-2020",
                  valuesScale: 1,
                  values: { br: [40, 60] },
                },
                "2024": {
                  imageId: "img-2024",
                  valuesScale: 1,
                  values: { br: [35, 65] },
                },
              },
            ),
          ),
        ]}
      />,
    );

    await waitFor(() => {
      const urls = vi
        .mocked(global.fetch)
        .mock.calls.map(([url]) => String(url));

      expect(urls).toEqual(
        expect.arrayContaining([
          "http://localhost:3000/api/municipal-analysis/layer-1?year=2024",
          `http://localhost:3000/api/municipal-analysis/layer-1/series?locationKey=${municipality.code}`,
        ]),
      );
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      const props = analysisPanelMock.mock.calls.at(-1)?.[0] as {
        years: Record<string, { values: Record<string, number[]> }>;
      };

      expect(props.years["2010"].values[municipality.code]).toEqual([10, 90]);
      expect(props.years["2020"].values[municipality.code]).toEqual([20, 80]);
      expect(props.years["2024"].values[municipality.code]).toEqual([30, 70]);
    });
  });

  it("loads other periods on demand and keeps previously loaded periods cached", async () => {
    useMapLayerViewStateMock.mockReturnValue({
      selectedState: municipality.uf,
      selectedMunicipalityCode: municipality.code,
      activeYear: "2010",
      spatialSelection: {
        spatialArea: "national",
        spatialValue: "brasil",
      },
    });

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      const requestUrl = new URL(url);
      const year = requestUrl.searchParams.get("year");

      return {
        ok: true,
        json: async () => ({
          imageData: {
            schemaVersion: 1,
            type: "territorial-compact",
            years: {
              [year ?? ""]: {
                valuesScale: 1,
                values: {
                  [municipality.code]:
                    year === "2020" ? [72.6, 27.4] : [0.1, 99.9],
                },
              },
            },
          },
        }),
      } as Response;
    });

    const panelLayers = [
      buildPanelLayer(
        {
          br: [45, 55],
          [municipality.uf]: [35, 65],
        },
        {
          "2010": {
            imageId: "img-2010",
            valuesScale: 1,
            values: {
              br: [45, 55],
              [municipality.uf]: [35, 65],
            },
          },
          "2020": {
            imageId: "img-2020",
            valuesScale: 1,
            values: {
              br: [99.9, 0.1],
              [municipality.uf]: [25, 75],
            },
          },
        },
      ),
    ];

    const { rerender } = render(
      <AnalysisContext
        activeSection="analysis-detail"
        panelLayers={panelLayers}
      />,
    );

    await waitFor(() => {
      const calls = vi.mocked(global.fetch).mock.calls.map(([url]) => {
        return new URL(url as string).searchParams.get("year");
      });

      expect(calls).toEqual(["2010"]);
    });

    await waitFor(() => {
      const props = analysisPanelMock.mock.calls.at(-1)?.[0] as {
        model: { distribution: Array<{ id: string; value: number }> } | null;
        years: Record<string, { values: Record<string, number[]> }>;
      };

      expect(props.model?.distribution[0]).toMatchObject({
        id: "a",
        value: 0.1,
      });
      expect(props.years["2010"].values[municipality.code][0]).toBe(0.1);
      expect(props.years["2020"].values[municipality.code]).toBeUndefined();
    });

    useMapLayerViewStateMock.mockReturnValue({
      selectedState: municipality.uf,
      selectedMunicipalityCode: municipality.code,
      activeYear: "2020",
      spatialSelection: {
        spatialArea: "national",
        spatialValue: "brasil",
      },
    });

    rerender(
      <AnalysisContext
        activeSection="analysis-detail"
        panelLayers={panelLayers}
      />,
    );

    await waitFor(() => {
      const calls = vi.mocked(global.fetch).mock.calls.map(([url]) => {
        return new URL(url as string).searchParams.get("year");
      });

      expect(calls).toEqual(["2010", "2020"]);
    });

    await waitFor(() => {
      const props = analysisPanelMock.mock.calls.at(-1)?.[0] as {
        model: { distribution: Array<{ id: string; value: number }> } | null;
        years: Record<string, { values: Record<string, number[]> }>;
      };

      expect(props.model?.distribution[0]).toMatchObject({
        id: "a",
        value: 72.6,
      });
      expect(props.years["2010"].values[municipality.code][0]).toBe(0.1);
      expect(props.years["2020"].values[municipality.code][0]).toBe(72.6);
    });
  });
});
