import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalyzePayload, AnalyzeFormProps } from "@/utils/amfeInterfaces";
import { CLASSIFICATION_MIN_ZOOM } from "@/components/Map/classificationLayers";
import { BRAZIL_TERRITORY_CODE } from "@/components/Map/stateSelection";

const { mapPropsMock, downloadWorkbookMock, boundaryOverlayMock } = vi.hoisted(
  () => ({
    mapPropsMock: vi.fn(),
    downloadWorkbookMock: vi.fn(),
    boundaryOverlayMock: vi.fn(),
  }),
);

const PAYLOAD: AnalyzePayload = {
  criteria: [{ name: "idhm", value: 1, is_benefit: false }],
  thresholds: { indifference: 0.1, preference: 0.3, veto: 0.8 },
  model: { version: "v1" },
  typeScenario: "optimistic",
  ranking: { level: "state" },
  interestArea: { type: "state", value: "PB" },
};

vi.mock("@/components/Map/MapComponent", () => ({
  default: (props: Record<string, unknown>) => {
    mapPropsMock(props);
    return <div data-testid="amfe-map-probe" />;
  },
}));

vi.mock("@/components/PlatformMap/useSpatialBoundaryOverlay", () => ({
  useSpatialBoundaryOverlay: (selection: unknown) => {
    boundaryOverlayMock(selection);
    return { boundaryGeoJson: null, status: "idle" as const };
  },
}));

vi.mock("@/components/Amfe/exportAnalysisWorkbook", () => ({
  downloadAnalysisWorkbook: downloadWorkbookMock,
}));

vi.mock("@/components/Amfe/AnalyzeForm/AnalyzeForm", () => ({
  default: ({ setFormPayload }: AnalyzeFormProps) => (
    <button type="button" onClick={() => setFormPayload(PAYLOAD)}>
      run-analysis
    </button>
  ),
}));

import { AmfeScreen } from "@/components/Amfe/AmfeScreen";

const ANALYZE_RESPONSE = {
  result: {
    "2500106": { name: "Areia", UF: "PB", classification: 4 },
    "2504009": { name: "Cabedelo", UF: "PB", classification: 1 },
  },
  excluded: { "2503209": { name: "Boqueirão", missing_fields: ["idhm"] } },
  count: 2,
  total_count: 3,
  excluded_count: 1,
};

const OVERVIEW_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { c: "2500106" },
      geometry: { type: "Polygon", coordinates: [] },
    },
  ],
};

let releaseOverview: (() => void) | null = null;

beforeEach(() => {
  mapPropsMock.mockReset();
  downloadWorkbookMock.mockReset();
  boundaryOverlayMock.mockReset();
  releaseOverview = null;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("brazil-cities-overview")) {
        if (releaseOverview) {
          await new Promise<void>((resolve) => {
            releaseOverview = () => resolve();
          });
        }
        return { ok: true, json: async () => OVERVIEW_GEOJSON };
      }
      return { ok: true, json: async () => ANALYZE_RESPONSE };
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AmfeScreen", () => {
  it("paints the analysis result as a choropleth on the platform map", async () => {
    const user = userEvent.setup();

    render(<AmfeScreen />);

    expect(mapPropsMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ municipalityClassification: null }),
    );

    await user.click(screen.getByRole("button", { name: "run-analysis" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/amfe/analyze",
        expect.objectContaining({ method: "POST" }),
      );
    });

    await waitFor(() => {
      const lastProps = mapPropsMock.mock.calls.at(-1)?.[0];
      expect(lastProps?.municipalityClassification).toEqual({
        classificationByCode: { "2500106": 4, "2504009": 1 },
        excludedCodes: ["2503209"],
      });
    });
  });

  it("opens framing the whole country instead of the choropleth zoom floor", () => {
    render(<AmfeScreen />);

    expect(mapPropsMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ minZoom: 3, zoom: 4 }),
    );
  });

  it("keeps the municipalities painted below the zoom floor of the vector tiles", async () => {
    const user = userEvent.setup();

    render(<AmfeScreen />);

    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("brazil-cities-overview"),
    );

    await user.click(screen.getByRole("button", { name: "run-analysis" }));

    await waitFor(() => {
      expect(mapPropsMock.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({
          municipalityOverviewGeoJson: OVERVIEW_GEOJSON,
        }),
      );
    });
  });

  it("frames the interest area the way the monitoring spatial scope does", async () => {
    const user = userEvent.setup();

    render(<AmfeScreen />);

    await user.click(screen.getByRole("button", { name: "run-analysis" }));

    await waitFor(() => {
      expect(mapPropsMock.mock.calls.at(-1)?.[0]?.allowedStateUfs).toEqual(
        new Set(["pb"]),
      );
    });

    expect(mapPropsMock.mock.calls.at(-1)?.[0]?.estadoSelecionado).toBe(
      BRAZIL_TERRITORY_CODE,
    );
  });

  it("explains the missing colour only while the overview geometry has not arrived", async () => {
    const user = userEvent.setup();
    releaseOverview = () => {};

    render(<AmfeScreen />);

    const emitZoom = (zoom: number) => {
      const onZoomChange = mapPropsMock.mock.calls.at(-1)?.[0]
        ?.onZoomChange as (zoom: number) => void;
      act(() => onZoomChange(zoom));
    };

    emitZoom(CLASSIFICATION_MIN_ZOOM - 1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "run-analysis" }));
    await screen.findByText(/2 de 3 municípios/);

    emitZoom(CLASSIFICATION_MIN_ZOOM - 1);
    expect(screen.getByRole("status")).toBeInTheDocument();

    emitZoom(CLASSIFICATION_MIN_ZOOM);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    emitZoom(CLASSIFICATION_MIN_ZOOM - 1);
    act(() => releaseOverview?.());
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("keeps the spatial selection stable across re-renders", async () => {
    render(<AmfeScreen />);

    const firstSelection = boundaryOverlayMock.mock.calls[0]?.[0];

    const onZoomChange = mapPropsMock.mock.calls.at(-1)?.[0]
      ?.onZoomChange as (zoom: number) => void;
    act(() => onZoomChange(7));

    expect(boundaryOverlayMock.mock.calls.length).toBeGreaterThan(1);
    expect(boundaryOverlayMock.mock.calls.at(-1)?.[0]).toBe(firstSelection);
  });

  it("shows the priority legend only when there is a choropleth to read", async () => {
    const user = userEvent.setup();

    render(<AmfeScreen />);

    expect(screen.queryByText("Nível de prioridade")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "run-analysis" }));

    expect(await screen.findByText("Nível de prioridade")).toBeInTheDocument();
  });

  it("shows the opacity control only when there is a choropleth to fade", async () => {
    const user = userEvent.setup();

    render(<AmfeScreen />);

    expect(
      screen.queryByRole("slider", { name: "Transparência" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "run-analysis" }));

    expect(
      await screen.findByRole("slider", { name: "Transparência" }),
    ).toHaveValue("0.85");
  });

  it("fades the choropleth fill without touching the basemap", async () => {
    const user = userEvent.setup();

    render(<AmfeScreen />);

    await user.click(screen.getByRole("button", { name: "run-analysis" }));
    const slider = await screen.findByRole("slider", {
      name: "Transparência",
    });

    fireEvent.change(slider, { target: { value: "0.4" } });

    expect(mapPropsMock.mock.calls.at(-1)?.[0]?.classificationFillOpacity).toBe(
      0.4,
    );
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("keeps the export menu on the map and enables the workbook with results", async () => {
    const user = userEvent.setup();

    render(<AmfeScreen />);

    await user.click(screen.getByRole("button", { name: /Download/ }));
    expect(screen.getByRole("button", { name: "XLSX" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Download/ }));

    await user.click(screen.getByRole("button", { name: "run-analysis" }));
    await waitFor(() => {
      expect(screen.getByText(/2 de 3 municípios/)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Download/ }));
    await user.click(screen.getByRole("button", { name: "XLSX" }));

    expect(downloadWorkbookMock).toHaveBeenCalledWith(
      ANALYZE_RESPONSE.result,
      PAYLOAD,
      expect.any(Function),
    );
  });

  it("reports the coverage returned by the backend", async () => {
    const user = userEvent.setup();

    render(<AmfeScreen />);

    await user.click(screen.getByRole("button", { name: "run-analysis" }));

    expect(
      await screen.findByText("2 de 3 municípios"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("(1 omitidos por dados ausentes)"),
    ).toBeInTheDocument();
  });
});
