import { describe, expect, it } from "vitest";
import type { FeatureCollection, Geometry } from "geojson";
import {
  geoBrasilSource,
  resolveSpatialFocusBounds,
} from "@/components/Map/mapBounds";
import { getAllowedStateUfs } from "@/utils/interestAreaStates";

type Bounds = [[number, number], [number, number]];

const brazilBounds = resolveSpatialFocusBounds(
  geoBrasilSource,
  null,
  null,
) as Bounds;

const boundary: FeatureCollection<Geometry, { name: string }> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Recorte" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-40, -10],
            [-38, -10],
            [-38, -8],
            [-40, -8],
            [-40, -10],
          ],
        ],
      },
    },
  ],
};

describe("resolveSpatialFocusBounds", () => {
  it("falls back to Brazil when no area restricts the selection", () => {
    expect(resolveSpatialFocusBounds(geoBrasilSource, null, null)).toEqual(
      brazilBounds,
    );
    expect(
      resolveSpatialFocusBounds(geoBrasilSource, new Set(), null),
    ).toEqual(brazilBounds);
  });

  it("prefers the real boundary over the composing states", () => {
    expect(
      resolveSpatialFocusBounds(geoBrasilSource, new Set(["ba"]), boundary),
    ).toEqual([
      [-40, -10],
      [-38, -8],
    ]);
  });

  it("ignores an empty boundary and uses the composing states", () => {
    const emptyBoundary: FeatureCollection<Geometry, { name: string }> = {
      type: "FeatureCollection",
      features: [],
    };

    expect(
      resolveSpatialFocusBounds(
        geoBrasilSource,
        new Set(["ba"]),
        emptyBoundary,
      ),
    ).toEqual(resolveSpatialFocusBounds(geoBrasilSource, new Set(["ba"]), null));
  });

  it("matches the lowercase UFs produced by getAllowedStateUfs", () => {
    const northeast = getAllowedStateUfs({
      spatialArea: "region",
      spatialValue: "Nordeste",
    });

    const bounds = resolveSpatialFocusBounds(
      geoBrasilSource,
      northeast,
      null,
    ) as Bounds;

    // Precisa casar UF minúscula do domínio com `info.sigla` maiúscula do
    // GeoJSON; sem normalizar, nenhuma feature entraria e o retorno seria null.
    expect(bounds).not.toBeNull();
    expect(bounds).not.toEqual(brazilBounds);
    // O Nordeste é bem mais estreito que o Brasil em longitude.
    expect(bounds[0][0]).toBeGreaterThan(brazilBounds[0][0]);
  });

  it("unions every state of the area instead of taking just one", () => {
    const single = resolveSpatialFocusBounds(
      geoBrasilSource,
      new Set(["pb"]),
      null,
    ) as Bounds;
    const pair = resolveSpatialFocusBounds(
      geoBrasilSource,
      new Set(["pb", "rs"]),
      null,
    ) as Bounds;

    expect(pair[0][1]).toBeLessThan(single[0][1]);
  });

  it("returns null when no state matches, so the camera stays put", () => {
    expect(
      resolveSpatialFocusBounds(geoBrasilSource, new Set(["zz"]), null),
    ).toBeNull();
  });
});
