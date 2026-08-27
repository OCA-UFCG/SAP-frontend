import { describe, expect, it, vi } from "vitest";
import type { Map as MaplibreMap, Popup } from "maplibre-gl";
import {
  applyBiomeHoverPreview,
  applyRegionHoverPreview,
  clearBiomeHoverPreview,
  clearRegionHoverPreview,
  type HoveredRegion,
} from "@/components/Map/spatialAreaHoverPreview";
import { SPATIAL_BOUNDARY_SOURCE_ID } from "@/components/Map/mapDefinitions";

/** Mapa mínimo que registra os estados de hover aplicados. */
class FakeHoverMap {
  readonly calls: Array<{ id: string | number; hover: boolean }> = [];
  private readonly canvas = { style: { cursor: "" } };

  setFeatureState = (
    target: { id: string | number; source: string },
    state: { hover: boolean },
  ) => {
    this.calls.push({ id: target.id, hover: state.hover });
  };

  getCanvas = () => this.canvas;

  hoveredIds = (hover: boolean) =>
    this.calls.filter((call) => call.hover === hover).map((call) => call.id);
}

class FakePopup {
  setLngLat = vi.fn(() => this);
  setText = vi.fn(() => this);
  addTo = vi.fn(() => this);
  remove = vi.fn(() => this);
}

const asMap = (fake: FakeHoverMap) => fake as unknown as MaplibreMap;
const asPopup = (fake: FakePopup) => fake as unknown as Popup;
const lngLat = { lng: -40, lat: -10 };

describe("applyRegionHoverPreview", () => {
  it("highlights every state of the region and names it in the popup", () => {
    const fakeMap = new FakeHoverMap();
    const popup = new FakePopup();
    const hoveredRegionRef: { current: HoveredRegion | null } = {
      current: null,
    };

    applyRegionHoverPreview(asMap(fakeMap), {
      regionName: "Sul",
      lngLat,
      popup: asPopup(popup),
      hoveredRegionRef,
    });

    expect(fakeMap.hoveredIds(true).sort()).toEqual(["PR", "RS", "SC"]);
    expect(hoveredRegionRef.current?.name).toBe("Sul");
    expect(popup.setText).toHaveBeenCalledWith("Sul");
  });

  it("clears the previous region before highlighting the next one", () => {
    const fakeMap = new FakeHoverMap();
    const popup = new FakePopup();
    const hoveredRegionRef: { current: HoveredRegion | null } = {
      current: { name: "Sul", ufs: ["PR", "RS", "SC"] },
    };

    applyRegionHoverPreview(asMap(fakeMap), {
      regionName: "Nordeste",
      lngLat,
      popup: asPopup(popup),
      hoveredRegionRef,
    });

    expect(fakeMap.hoveredIds(false).sort()).toEqual(["PR", "RS", "SC"]);
    expect(hoveredRegionRef.current?.name).toBe("Nordeste");
    expect(hoveredRegionRef.current?.ufs).toHaveLength(9);
  });

  it("does not repaint the same region on every mouse move", () => {
    const fakeMap = new FakeHoverMap();
    const popup = new FakePopup();
    const hoveredRegionRef: { current: HoveredRegion | null } = {
      current: { name: "Sul", ufs: ["PR", "RS", "SC"] },
    };

    applyRegionHoverPreview(asMap(fakeMap), {
      regionName: "Sul",
      lngLat,
      popup: asPopup(popup),
      hoveredRegionRef,
    });

    expect(fakeMap.calls).toEqual([]);
    expect(popup.setText).toHaveBeenCalledWith("Sul");
  });
});

describe("applyBiomeHoverPreview", () => {
  it("darkens the hovered biome by name and names it in the popup", () => {
    const fakeMap = new FakeHoverMap();
    const popup = new FakePopup();
    const hoveredBoundaryRef: { current: string | null } = { current: null };

    applyBiomeHoverPreview(asMap(fakeMap), {
      biomeName: "Caatinga",
      lngLat,
      popup: asPopup(popup),
      hoveredBoundaryRef,
    });

    // `promoteId: "name"` faz o id da feature ser o nome do bioma.
    expect(fakeMap.calls).toEqual([{ id: "Caatinga", hover: true }]);
    expect(hoveredBoundaryRef.current).toBe("Caatinga");
    expect(popup.setText).toHaveBeenCalledWith("Caatinga");
  });

  it("clears the previous biome before darkening the next one", () => {
    const fakeMap = new FakeHoverMap();
    const hoveredBoundaryRef: { current: string | null } = {
      current: "Cerrado",
    };

    applyBiomeHoverPreview(asMap(fakeMap), {
      biomeName: "Caatinga",
      lngLat,
      popup: asPopup(new FakePopup()),
      hoveredBoundaryRef,
    });

    expect(fakeMap.calls).toEqual([
      { id: "Cerrado", hover: false },
      { id: "Caatinga", hover: true },
    ]);
  });
});

describe("clearing hover previews", () => {
  it("is a no-op when nothing is highlighted", () => {
    const fakeMap = new FakeHoverMap();

    clearRegionHoverPreview(asMap(fakeMap), { current: null });
    clearBiomeHoverPreview(asMap(fakeMap), { current: null });

    expect(fakeMap.calls).toEqual([]);
  });

  it("survives being called without a map instance", () => {
    const hoveredRegionRef: { current: HoveredRegion | null } = {
      current: { name: "Sul", ufs: ["PR"] },
    };
    const hoveredBoundaryRef: { current: string | null } = {
      current: "Caatinga",
    };

    clearRegionHoverPreview(null, hoveredRegionRef);
    clearBiomeHoverPreview(null, hoveredBoundaryRef);

    expect(hoveredRegionRef.current).toBeNull();
    expect(hoveredBoundaryRef.current).toBeNull();
  });

  it("uses the boundary source when clearing a biome", () => {
    const fakeMap = new FakeHoverMap();
    const setFeatureState = vi.spyOn(fakeMap, "setFeatureState");

    clearBiomeHoverPreview(asMap(fakeMap), { current: "Pampa" });

    expect(setFeatureState).toHaveBeenCalledWith(
      { source: SPATIAL_BOUNDARY_SOURCE_ID, id: "Pampa" },
      { hover: false },
    );
  });
});
