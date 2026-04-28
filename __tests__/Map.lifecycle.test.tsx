import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mapInstances, MapConstructorMock } = vi.hoisted(() => ({
  mapInstances: [] as Array<{
    fitBounds: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    setPadding: ReturnType<typeof vi.fn>;
  }>,
  MapConstructorMock: vi.fn(),
}));

function mockElementWidth(element: HTMLElement, width: number) {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: vi.fn(() => ({ width })),
  });
}

vi.mock("maplibre-gl", () => {
  const MockPopup = class {
    remove = vi.fn();
    setLngLat = vi.fn(() => this);
    setText = vi.fn(() => this);
    addTo = vi.fn(() => this);
  };

  const MockMarker = class {
    remove = vi.fn();
    setLngLat = vi.fn(() => this);
    setPopup = vi.fn(() => this);
    addTo = vi.fn(() => this);
  };

  const MockMap = class {
    addControl = vi.fn(() => this);
    jumpTo = vi.fn(() => this);
    on = vi.fn(() => this);
    once = vi.fn(() => this);
    getSource = vi.fn((sourceId?: string) => {
      if (sourceId === "brazil-states" || sourceId === "cdi-data") {
        return {};
      }

      return undefined;
    });
    getLayer = vi.fn(() => undefined);
    getStyle = vi.fn(() => ({ sources: {} }));
    addSource = vi.fn(() => this);
    addLayer = vi.fn(() => this);
    removeLayer = vi.fn(() => this);
    removeSource = vi.fn(() => this);
    isStyleLoaded = vi.fn(() => true);
    fitBounds = vi.fn(() => this);
    setPadding = vi.fn(() => this);
    setFeatureState = vi.fn(() => this);
    getFeatureState = vi.fn(() => ({}));
    setLayoutProperty = vi.fn(() => this);
    getContainer = vi.fn(() => ({ clientWidth: 1280 }));
    getCanvas = vi.fn(() => ({ style: { cursor: "" } }));
    remove = vi.fn();
    scrollZoom = {
      disable: vi.fn(),
      enable: vi.fn(),
    };

    constructor(public readonly options: unknown) {
      MapConstructorMock(options);
      mapInstances.push(this);
    }
  };

  return {
    default: {
      Map: MockMap,
      Popup: MockPopup,
      Marker: MockMarker,
      AttributionControl: class {},
      NavigationControl: class {},
    },
    Map: MockMap,
    Popup: MockPopup,
    Marker: MockMarker,
    AttributionControl: class {},
    NavigationControl: class {},
  };
});

import Map from "@/components/Map/Map";

describe("Map lifecycle", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    mapInstances.length = 0;
    MapConstructorMock.mockClear();
  });

  it("does not recreate the MapLibre instance when the selected state changes", () => {
    const { rerender, unmount } = render(
      <Map center={[-15.749997, -47.9499962]} estadoSelecionado="BR" />,
    );

    expect(MapConstructorMock).toHaveBeenCalledTimes(1);

    const firstInstance = mapInstances[0];
    expect(firstInstance).toBeDefined();

    rerender(<Map center={[-15.749997, -47.9499962]} estadoSelecionado="GO" />);

    expect(MapConstructorMock).toHaveBeenCalledTimes(1);
    expect(firstInstance.remove).not.toHaveBeenCalled();

    unmount();

    expect(firstInstance.remove).toHaveBeenCalledTimes(1);
  });

  it("keeps map padding aligned with the sidebar so centered zoom stays on the selected state", async () => {
    document.body.innerHTML = `
      <aside data-platform-sidebar-overlay>
        <div data-platform-side-rail></div>
        <div data-platform-side-panel></div>
      </aside>
    `;

    const sideRail = document.querySelector(
      "[data-platform-side-rail]",
    ) as HTMLElement;
    const sidePanel = document.querySelector(
      "[data-platform-side-panel]",
    ) as HTMLElement;

    mockElementWidth(sideRail, 140);
    mockElementWidth(sidePanel, 420);

    render(<Map center={[-15.749997, -47.9499962]} estadoSelecionado="GO" />);

    const firstInstance = mapInstances[0];

    await waitFor(() => {
      expect(firstInstance.setPadding).toHaveBeenLastCalledWith({
        top: 0,
        right: 0,
        bottom: 0,
        left: 560,
      });
      expect(firstInstance.fitBounds).toHaveBeenLastCalledWith(
        expect.any(Array),
        expect.objectContaining({
          padding: {
            top: 200,
            right: 200,
            bottom: 200,
            left: 200,
          },
        }),
      );
    });
  });
});
