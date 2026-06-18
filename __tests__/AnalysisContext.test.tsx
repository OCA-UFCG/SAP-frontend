import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/telemetry/client", () => ({
  trackUiEvent: vi.fn(),
}));

import citiesIndex from "@/data/citiesIndex.json";
import { AnalysisContext } from "@/components/SidePanelContexts/AnalysisContext";
import { trackUiEvent } from "@/services/telemetry/client";
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

function buildPanelLayer(values: Record<string, number[]>): PanelLayerI {
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
      },
      years: {
        "2024": {
          imageId: "img-2024",
          valuesScale: 1,
          values,
        },
      },
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
    });

    useMapLayerActionsMock.mockReturnValue({
      setSelectedState: vi.fn(),
      setSelectedMunicipalityCode: vi.fn(),
      setActiveLegend: vi.fn(),
      setActiveYear: vi.fn(),
      resetPlatformState: vi.fn(),
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

  it("fetches municipal analysis for the active layer and year only", async () => {
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

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/municipal-analysis/layer-1?year=2024",
        expect.objectContaining({
          credentials: "same-origin",
          signal: expect.any(AbortSignal),
        }),
      );
    });
  });
});
