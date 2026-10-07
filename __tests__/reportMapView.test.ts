import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/Map/mapBounds", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/Map/mapBounds")>();
  return {
    ...actual,
    getIndexedMunicipalityBounds: vi.fn(() => [
      [-36.2, -7.4],
      [-35.8, -7.1],
    ]),
  };
});

import {
  fitFrameBounds,
  REPORT_MAP_FRAME,
  resolveReportMapView,
} from "@/components/MunicipalReport/reportMapView";
import { resolveReportTerritory } from "@/utils/reportTerritory";

/** Graus para a fração do mundo em Web Mercator, como o MapLibre mede. */
function mercator(longitude: number, latitude: number) {
  const sin = Math.sin((latitude * Math.PI) / 180);
  return {
    x: (longitude + 180) / 360,
    y: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI),
  };
}

function frameSize([west, south, east, north]: number[]) {
  const southWest = mercator(west, south);
  const northEast = mercator(east, north);
  return {
    width: northEast.x - southWest.x,
    height: southWest.y - northEast.y,
  };
}

describe("fitFrameBounds", () => {
  const territory: [number, number, number, number] = [
    -36.2, -7.4, -35.8, -7.1,
  ];

  // A miniatura só encaixa no quadro se o recorte tiver a forma do quadro.
  it("returns a view with the frame proportions in Web Mercator", () => {
    const { width, height } = frameSize(
      fitFrameBounds(territory, REPORT_MAP_FRAME, 36),
    );

    expect(width / height).toBeCloseTo(
      REPORT_MAP_FRAME.width / REPORT_MAP_FRAME.height,
      4,
    );
  });

  it("keeps the territory inside the view with the requested padding", () => {
    const view = fitFrameBounds(territory, REPORT_MAP_FRAME, 36);
    const viewSize = frameSize(view);
    const territorySize = frameSize(territory);
    const pixelsPerUnit = REPORT_MAP_FRAME.height / viewSize.height;

    expect(view[0]).toBeLessThan(territory[0]);
    expect(view[2]).toBeGreaterThan(territory[2]);
    // O território é mais alto que o quadro, então é a altura que encosta na
    // folga de 36 px.
    expect(
      (viewSize.height - territorySize.height) * pixelsPerUnit,
    ).toBeCloseTo(72, 0);
  });

  // Um município minúsculo não pode virar um mapa de quarteirão.
  it("stops at the maximum zoom for a tiny territory", () => {
    const tiny: [number, number, number, number] = [
      -35.881, -7.231, -35.879, -7.229,
    ];
    const { width } = frameSize(
      fitFrameBounds(tiny, REPORT_MAP_FRAME, 36, 14.5),
    );

    // Os cantos saem arredondados em 6 casas decimais (~10 cm).
    expect(width / (REPORT_MAP_FRAME.width / (512 * 2 ** 14.5))).toBeCloseTo(
      1,
      3,
    );
  });
});

describe("resolveReportMapView", () => {
  it("asks for an image slightly larger than the frame of a municipality", () => {
    const view = resolveReportMapView(resolveReportTerritory("2504009")!)!;
    const [west, south, east, north] = view.thumbnail.bbox;

    expect(view.thumbnail).toMatchObject({ width: 936, height: 433 });
    expect(west).toBeLessThan(view.frame[0]);
    expect(south).toBeLessThan(view.frame[1]);
    expect(east).toBeGreaterThan(view.frame[2]);
    expect(north).toBeGreaterThan(view.frame[3]);
  });

  // Numa imagem só, a cobertura da terra levava 23 s no Cerrado e estourava a
  // memória do Earth Engine no Brasil; em tiles, 8 s.
  it.each(["pb", "3_bioma-caatinga", "br"])(
    "keeps %s in tiles",
    (locationKey) => {
      expect(
        resolveReportMapView(resolveReportTerritory(locationKey)!),
      ).toBeNull();
    },
  );
});
