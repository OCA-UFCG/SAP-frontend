import { describe, expect, it, vi } from "vitest";

const eeMocks = vi.hoisted(() => {
  const nationalCollection = { kind: "national-boundary" };
  const filter = vi.fn(() => nationalCollection);
  return {
    feature: vi.fn((geometry) => ({ geometry })),
    featureCollection: vi.fn((value) =>
      typeof value === "string" ? { filter } : { features: value },
    ),
    filter,
    filterEq: vi.fn((property, value) => ({
      kind: "property-filter",
      property,
      value,
    })),
    geometry: vi.fn((value) => ({ value })),
    nationalCollection,
  };
});

vi.mock("@google/earthengine", () => ({
  default: {
    Feature: eeMocks.feature,
    FeatureCollection: eeMocks.featureCollection,
    Filter: { eq: eeMocks.filterEq },
    Geometry: eeMocks.geometry,
  },
}));

vi.mock("@/app/api/ee/spatialBoundaries", () => ({
  getSpatialBoundaryFeatures: vi.fn(() => [
    { geometry: { type: "Polygon", coordinates: [] } },
    { geometry: { type: "MultiPolygon", coordinates: [] } },
  ]),
}));

vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayers: vi.fn(),
}));

import {
  applySpatialClip,
  selectImageCollectionImage,
  shouldApplySelfMask,
} from "@/app/api/ee/services";

describe("Earth Engine self mask selection", () => {
  it("keeps zero-valued pixels visible when the layer scale includes zero", () => {
    expect(
      shouldApplySelfMask({
        imageParams: [
          { color: "#111111", label: "Low", pixelLimit: 1 },
          { color: "#222222", label: "High", pixelLimit: 2 },
        ],
        minScale: 0,
        maxScale: 25,
        mapVisualization: {
          min: 1,
          max: 6,
          palette: ["#111111", "#222222"],
          sourceBand: "Gpp",
          band: "gpp_class",
          thresholds: [7000, 13000],
        },
      }),
    ).toBe(false);
  });

  it("keeps zero-valued class rasters visible when imageParams define class zero", () => {
    expect(
      shouldApplySelfMask({
        imageParams: [
          { color: "#c2c2c4", label: "Sem seca", pixelLimit: 0 },
          { color: "#ffff00", label: "Estágio 1", pixelLimit: 1 },
        ],
        minScale: 0,
        maxScale: 5,
      }),
    ).toBe(false);
  });

  it("keeps self-mask enabled when the configured range does not include zero", () => {
    expect(
      shouldApplySelfMask({
        imageParams: [
          { color: "#ffff00", label: "Árido", pixelLimit: 1 },
          { color: "#ffa500", label: "Semiárido", pixelLimit: 2 },
        ],
        minScale: 2,
        maxScale: 5,
      }),
    ).toBe(true);
  });
});

describe("Earth Engine spatial clipping", () => {
  it("clips raster output to the canonical national collection", () => {
    const image = { clipToCollection: vi.fn(() => "clipped") };

    expect(applySpatialClip(image)).toBe("clipped");
    expect(image.clipToCollection).toHaveBeenCalledWith(
      eeMocks.nationalCollection,
    );
  });

  it("clips rendered FeatureCollection output to all ASD boundaries", () => {
    const renderedFeatureCollection = {
      clipToCollection: vi.fn(() => "clipped-feature-collection"),
    };

    expect(
      applySpatialClip(renderedFeatureCollection, {
        spatialArea: "asd",
        spatialValue: "ASD",
      }),
    ).toBe("clipped-feature-collection");
    expect(eeMocks.geometry).toHaveBeenCalledTimes(2);
    expect(eeMocks.feature).toHaveBeenCalledTimes(2);
    expect(renderedFeatureCollection.clipToCollection).toHaveBeenCalledWith({
      features: expect.any(Array),
    });
  });
});

describe("Earth Engine image collection selection", () => {
  it("selects a lead from the latest CPTEC issuance and keeps the first band", () => {
    eeMocks.filterEq.mockClear();
    const selectedImage = {
      projection: vi.fn(() => "native-projection"),
      select: vi.fn(() => "selected"),
    };
    const collection = {
      aggregate_array: vi.fn(() => ({
        sort: () => ({ get: () => "2026-08-01" }),
      })),
      filter: vi.fn(),
      sort: vi.fn(),
      first: vi.fn(() => selectedImage),
    };
    collection.filter.mockReturnValue(collection);
    collection.sort.mockReturnValue(collection);

    expect(
      selectImageCollectionImage(collection, {
        latestProperty: "data_emissao",
        filterProperty: "lead_time",
        filterValue: 3,
        sortProperty: "lead_time",
        selectFirstBand: true,
      }),
    ).toBe("selected");
    expect(eeMocks.filterEq).toHaveBeenNthCalledWith(
      1,
      "data_emissao",
      "2026-08-01",
    );
    expect(eeMocks.filterEq).toHaveBeenNthCalledWith(2, "lead_time", 3);
    expect(collection.sort).toHaveBeenCalledWith("lead_time");
    expect(selectedImage.select).toHaveBeenCalledWith(0);
    expect(selectedImage.projection).not.toHaveBeenCalled();
  });
});
