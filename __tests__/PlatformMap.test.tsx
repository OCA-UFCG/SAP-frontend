import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

type MapComponentProps = ComponentProps<
  typeof import("@/components/Map/Map").default
>;

const useEarthEngineTileLayerMock = vi.fn();
const useMapLayerActiveStateMock = vi.fn();
const useMapLayerViewStateMock = vi.fn();
const useMapLayerActionsMock = vi.fn();
let latestMapProps: MapComponentProps | null = null;

vi.mock("next/dynamic", () => ({
  default: () => {
    return function MockMapComponent(props: MapComponentProps) {
      latestMapProps = props;
      return <div data-testid="map-component" />;
    };
  },
}));

vi.mock("@/components/PlatformMap/useEarthEngineTileLayer", () => ({
  useEarthEngineTileLayer: (
    ...args: Parameters<typeof useEarthEngineTileLayerMock>
  ) => useEarthEngineTileLayerMock(...args),
}));

vi.mock("@/components/MapLayerContext/MapLayerContext", () => ({
  useMapLayerActiveState: () => useMapLayerActiveStateMock(),
  useMapLayerViewState: () => useMapLayerViewStateMock(),
  useMapLayerActions: () => useMapLayerActionsMock(),
}));

const useSpatialBoundaryOverlayMock = vi.fn();

vi.mock("@/components/PlatformMap/useSpatialBoundaryOverlay", () => ({
  useSpatialBoundaryOverlay: () => useSpatialBoundaryOverlayMock(),
}));

import { PlatformMap } from "@/components/PlatformMap/PlatformMap";
import {
  geoBrasilSource,
  resolveSpatialFocusBounds,
} from "@/components/Map/mapBounds";
import { getAllowedStateUfs } from "@/utils/interestAreaStates";

describe("PlatformMap", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    latestMapProps = null;
    useEarthEngineTileLayerMock.mockReset();
    useMapLayerActiveStateMock.mockReset();
    useMapLayerViewStateMock.mockReset();
    useMapLayerActionsMock.mockReset();
    useSpatialBoundaryOverlayMock.mockReset();
    useSpatialBoundaryOverlayMock.mockReturnValue({
      boundaryGeoJson: null,
      activeBoundaryGeoJson: null,
      status: "idle",
    });

    useMapLayerActiveStateMock.mockReturnValue({
      activeData: null,
      activeEEData: { id: "ee-layer" },
    });
    useMapLayerViewStateMock.mockReturnValue({
      activeLegend: null,
      selectedState: "br",
      activeYear: "2024",
      layerOpacity: 0.85,
      spatialSelection: {
        spatialArea: "national",
        spatialValue: "brasil",
      },
    });
    useMapLayerActionsMock.mockReturnValue({
      setSelectedState: vi.fn(),
      setSelectedMunicipalityCode: vi.fn(),
      setLayerOpacity: vi.fn(),
      setSpatialSelection: vi.fn(),
    });
  });

  it("shows a centered loading overlay while the GEE url is being fetched", () => {
    useEarthEngineTileLayerMock.mockReturnValue({
      requestKey: "ee-layer:2024",
      status: "loading",
      tileLayerUrl: undefined,
    });

    render(<PlatformMap />);

    expect(
      screen.getByRole("status", { name: "Carregando camada do GEE" }),
    ).toBeInTheDocument();
    expect(latestMapProps?.tileLayerRequestKey).toBe("ee-layer:2024");
  });

  it("keeps the overlay visible until the map reports the first tile is ready", async () => {
    useEarthEngineTileLayerMock.mockReturnValue({
      requestKey: "ee-layer:2024",
      status: "ready",
      tileLayerUrl: "https://tiles.example/2024",
    });

    render(<PlatformMap />);

    expect(
      screen.getByRole("status", { name: "Carregando camada do GEE" }),
    ).toBeInTheDocument();
    expect(latestMapProps?.tileLayerUrl).toBe("https://tiles.example/2024");

    act(() => {
      latestMapProps?.onTileLayerReady?.("ee-layer:2024");
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("status", { name: "Carregando camada do GEE" }),
      ).not.toBeInTheDocument();
    });
  });

  it("labels the opacity control for assistive technologies", () => {
    useEarthEngineTileLayerMock.mockReturnValue({
      requestKey: "ee-layer:2024",
      status: "ready",
      tileLayerUrl: "https://tiles.example/2024",
    });

    render(<PlatformMap />);

    expect(screen.getByRole("slider", { name: "Transparência" })).toHaveValue(
      "0.85",
    );
  });

  it("switches between street and satellite basemaps", () => {
    useEarthEngineTileLayerMock.mockReturnValue({
      requestKey: "ee-layer:2024",
      status: "ready",
      tileLayerUrl: "https://tiles.example/2024",
    });

    render(<PlatformMap />);

    const streetButton = screen.getByRole("button", { name: "Rua" });
    const satelliteButton = screen.getByRole("button", { name: "Satélite" });
    expect(latestMapProps?.basemap).toBe("osm");
    expect(streetButton).toHaveAttribute("aria-pressed", "true");
    expect(satelliteButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(satelliteButton);

    expect(latestMapProps?.basemap).toBe("satellite");
    expect(streetButton).toHaveAttribute("aria-pressed", "false");
    expect(satelliteButton).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("group", { name: "Mapa base" }),
    ).toBeInTheDocument();
  });

  it("hides monitoring overlays outside monitoring without changing opacity", () => {
    useEarthEngineTileLayerMock.mockReturnValue({
      requestKey: "ee-layer:2024",
      status: "ready",
      tileLayerUrl: "https://tiles.example/2024",
    });

    useMapLayerViewStateMock.mockReturnValue({
      activeLegend: [{ label: "Seca", color: "#f00" }],
      selectedState: "br",
      activeYear: "2024",
      layerOpacity: 0.85,
      spatialSelection: {
        spatialArea: "national",
        spatialValue: "brasil",
      },
    });

    const { rerender } = render(<PlatformMap showMonitoringOverlays />);

    expect(screen.getByRole("slider", { name: "Transparência" })).toHaveValue(
      "0.85",
    );
    expect(
      screen.getByRole("heading", { name: "Legendas" }),
    ).toBeInTheDocument();

    rerender(<PlatformMap showMonitoringOverlays={false} />);

    expect(
      screen.queryByRole("group", { name: "Mapa base" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("slider", { name: "Transparência" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Legenda do mapa" }),
    ).not.toBeInTheDocument();
    expect(useMapLayerActionsMock().setLayerOpacity).not.toHaveBeenCalled();
  });

  describe("focus bounds for the selected interest area", () => {
    const readyTileLayer = {
      requestKey: "ee-layer:2024",
      status: "ready",
      tileLayerUrl: "https://tiles.example/2024",
    };

    const viewStateFor = (spatialSelection: unknown) => ({
      activeLegend: null,
      selectedState: "br",
      activeYear: "2024",
      layerOpacity: 0.85,
      spatialSelection,
    });

    beforeEach(() => {
      useEarthEngineTileLayerMock.mockReturnValue(readyTileLayer);
    });

    it("frames Brazil for the national area", () => {
      render(<PlatformMap />);

      expect(latestMapProps?.spatialFocusBounds).toEqual(
        resolveSpatialFocusBounds(geoBrasilSource, null, null),
      );
    });

    it("frames the states that compose a selected region", () => {
      useMapLayerViewStateMock.mockReturnValue(
        viewStateFor({ spatialArea: "region", spatialValue: "Nordeste" }),
      );

      render(<PlatformMap />);

      expect(latestMapProps?.spatialFocusBounds).toEqual(
        resolveSpatialFocusBounds(
          geoBrasilSource,
          getAllowedStateUfs({
            spatialArea: "region",
            spatialValue: "Nordeste",
          }),
          null,
        ),
      );
      expect(latestMapProps?.spatialFocusBounds).not.toEqual(
        resolveSpatialFocusBounds(geoBrasilSource, null, null),
      );
    });

    it("waits for the real boundary instead of framing the composing states", () => {
      useSpatialBoundaryOverlayMock.mockReturnValue({
        boundaryGeoJson: null,
        activeBoundaryGeoJson: null,
        status: "loading",
      });
      useMapLayerViewStateMock.mockReturnValue(
        viewStateFor({ spatialArea: "biome", spatialValue: "Caatinga" }),
      );

      render(<PlatformMap />);

      // Enquadrar agora causaria um movimento grosseiro seguido do correto.
      expect(latestMapProps?.spatialFocusBounds).toBeNull();
    });

    const boundaryFeature = (
      name: string,
      [west, south, east, north]: [number, number, number, number],
    ) => ({
      type: "Feature" as const,
      properties: { name },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [west, south],
            [east, south],
            [east, north],
            [west, north],
            [west, south],
          ],
        ],
      },
    });

    it("frames the real boundary once it arrives", () => {
      const caatinga = boundaryFeature("Caatinga", [-44, -16, -36, -3]);
      useSpatialBoundaryOverlayMock.mockReturnValue({
        status: "ready",
        boundaryGeoJson: { type: "FeatureCollection", features: [caatinga] },
        activeBoundaryGeoJson: {
          type: "FeatureCollection",
          features: [caatinga],
        },
      });
      useMapLayerViewStateMock.mockReturnValue(
        viewStateFor({ spatialArea: "biome", spatialValue: "Caatinga" }),
      );

      render(<PlatformMap />);

      expect(latestMapProps?.spatialFocusBounds).toEqual([
        [-44, -16],
        [-36, -3],
      ]);
    });

    it("frames the selected biome, not the whole collection drawn on the map", () => {
      // Regressão: enquadrar pela coleção inteira dá a caixa do Brasil, e ela é
      // a mesma para os seis biomas — a câmera parava de se mover na troca.
      const caatinga = boundaryFeature("Caatinga", [-44, -16, -36, -3]);
      const pampa = boundaryFeature("Pampa", [-57, -33, -49, -28]);
      useSpatialBoundaryOverlayMock.mockReturnValue({
        status: "ready",
        boundaryGeoJson: {
          type: "FeatureCollection",
          features: [caatinga, pampa],
        },
        activeBoundaryGeoJson: {
          type: "FeatureCollection",
          features: [caatinga],
        },
      });
      useMapLayerViewStateMock.mockReturnValue(
        viewStateFor({ spatialArea: "biome", spatialValue: "Caatinga" }),
      );

      render(<PlatformMap />);

      expect(latestMapProps?.spatialFocusBounds).toEqual([
        [-44, -16],
        [-36, -3],
      ]);
      // E o mapa continua recebendo a coleção inteira para desenhar e clicar.
      expect(latestMapProps?.spatialBoundaryGeoJson?.features).toHaveLength(2);
    });

    it("falls back to the composing states when the boundary fetch fails", () => {
      useSpatialBoundaryOverlayMock.mockReturnValue({
        boundaryGeoJson: null,
        activeBoundaryGeoJson: null,
        status: "error",
      });
      useMapLayerViewStateMock.mockReturnValue(
        viewStateFor({ spatialArea: "biome", spatialValue: "Caatinga" }),
      );

      render(<PlatformMap />);

      expect(latestMapProps?.spatialFocusBounds).toEqual(
        resolveSpatialFocusBounds(
          geoBrasilSource,
          getAllowedStateUfs({
            spatialArea: "biome",
            spatialValue: "Caatinga",
          }),
          null,
        ),
      );
    });
  });
});
