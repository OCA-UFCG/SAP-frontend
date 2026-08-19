import type { Feature, Geometry } from "geojson";
import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/ee/spatialBoundaries", () => ({
  getSpatialBoundaryFeatures: vi.fn(),
}));

import { GET } from "@/app/api/spatial-boundary/route";
import { getSpatialBoundaryFeatures } from "@/app/api/ee/spatialBoundaries";

const mockedGetSpatialBoundaryFeatures = vi.mocked(getSpatialBoundaryFeatures);

const caatingaFeature: Feature<Geometry, { name: string }> = {
  type: "Feature",
  properties: { name: "Caatinga" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-40, -10],
        [-39, -10],
        [-39, -9],
        [-40, -10],
      ],
    ],
  },
};

function createRequest(query = ""): NextRequest {
  return {
    nextUrl: new URL(`https://example.test/api/spatial-boundary${query}`),
  } as NextRequest;
}

describe("GET /api/spatial-boundary", () => {
  beforeEach(() => {
    mockedGetSpatialBoundaryFeatures.mockReset();
  });

  it("returns the selected boundary as cacheable GeoJSON", async () => {
    mockedGetSpatialBoundaryFeatures.mockReturnValueOnce([caatingaFeature]);

    const response = await GET(
      createRequest("?spatialArea=biome&spatialValue=Caatinga"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=86400, s-maxage=86400",
    );
    await expect(response.json()).resolves.toEqual({
      type: "FeatureCollection",
      features: [caatingaFeature],
    });
    expect(mockedGetSpatialBoundaryFeatures).toHaveBeenCalledWith({
      spatialArea: "biome",
      spatialValue: "Caatinga",
    });
  });

  it("rejects incomplete or invalid selections", async () => {
    const missingValue = await GET(createRequest("?spatialArea=biome"));
    const invalidValue = await GET(
      createRequest("?spatialArea=biome&spatialValue=Nordeste"),
    );

    expect(missingValue.status).toBe(400);
    expect(invalidValue.status).toBe(400);
    expect(mockedGetSpatialBoundaryFeatures).not.toHaveBeenCalled();
  });

  it("rejects administrative scopes that do not use an overlay", async () => {
    const national = await GET(
      createRequest("?spatialArea=national&spatialValue=brasil"),
    );
    const region = await GET(
      createRequest("?spatialArea=region&spatialValue=Nordeste"),
    );

    expect(national.status).toBe(400);
    expect(region.status).toBe(400);
    expect(mockedGetSpatialBoundaryFeatures).not.toHaveBeenCalled();
  });

  it("returns 500 when the boundary repository fails", async () => {
    mockedGetSpatialBoundaryFeatures.mockImplementationOnce(() => {
      throw new Error("boundary unavailable");
    });

    const response = await GET(
      createRequest("?spatialArea=biome&spatialValue=Caatinga"),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "boundary unavailable",
    });
  });
});
