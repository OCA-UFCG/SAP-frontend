import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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

import { PlatformMap } from "@/components/PlatformMap/PlatformMap";

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

    useMapLayerActiveStateMock.mockReturnValue({
      activeData: null,
      activeEEData: { id: "ee-layer" },
    });
    useMapLayerViewStateMock.mockReturnValue({
      activeLegend: null,
      selectedState: "br",
      activeYear: "2024",
    });
    useMapLayerActionsMock.mockReturnValue({
      setSelectedState: vi.fn(),
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
});
