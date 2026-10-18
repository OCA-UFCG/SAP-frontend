import type { EeMapThumbnailView } from "@/contracts/eeMapUrls";
import type { MunicipalReportTerritory } from "@/contracts/municipalReport";
import {
  getIndexedMunicipalityBounds,
  MAP_MUNICIPALITY_FOCUS_MAX_ZOOM,
} from "@/components/Map/mapBounds";

/** O quadro do mapa no relatório (`aspect-[696/322]`), em pixels CSS. */
export const REPORT_MAP_FRAME = { width: 696, height: 322 };
/**
 * Largura da miniatura sem a folga. Os tiles entregavam um pixel do Earth
 * Engine por pixel de tela, e o quadro tem ~870 px numa tela de notebook.
 */
const REPORT_MAP_THUMBNAIL_WIDTH = 900;
/**
 * Quanto a miniatura passa do quadro em cada lado. Um quadro com um pixel a
 * mais por arredondamento mostraria uma borda sem o índice.
 */
const REPORT_MAP_IMAGE_MARGIN = 0.02;
/** A mesma folga em volta do município que o mapa usava ao focá-lo. */
const REPORT_MAP_MUNICIPALITY_PADDING = 36;
/** O MapLibre mede o mundo em blocos de 512 px no zoom 0. */
const WORLD_SIZE_PX = 512;

type Bounds = [west: number, south: number, east: number, north: number];

/**
 * O recorte de um mapa do relatório. É o mesmo para todos os mapas do
 * documento, porque todos mostram o mesmo território no mesmo quadro.
 */
export interface ReportMapView {
  /** O que o quadro mostra: a câmera do mapa é ajustada a este retângulo. */
  frame: Bounds;
  /** A miniatura pedida ao Earth Engine: o quadro com uma folga em cada lado. */
  thumbnail: EeMapThumbnailView;
}

/** Uma camada do relatório desenhada como uma imagem só. */
export interface ReportMapThumbnail {
  url: string;
  view: ReportMapView;
}

/** Graus para a fração do mundo em Web Mercator, de 0 a 1, com y para o sul. */
function project(longitude: number, latitude: number) {
  const sin = Math.sin((latitude * Math.PI) / 180);
  return {
    x: (longitude + 180) / 360,
    y: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI),
  };
}

function unproject(x: number, y: number) {
  return {
    longitude: x * 360 - 180,
    latitude: (360 / Math.PI) * Math.atan(Math.exp((1 - 2 * y) * Math.PI)) - 90,
  };
}

const roundCoordinate = (value: number) => Math.round(value * 1e6) / 1e6;

/** O retângulo de `x` e `y` em Web Mercator, de volta para graus. */
function toDegrees(minX: number, minY: number, maxX: number, maxY: number) {
  const southWest = unproject(minX, maxY);
  const northEast = unproject(maxX, minY);
  return [
    southWest.longitude,
    southWest.latitude,
    northEast.longitude,
    northEast.latitude,
  ].map(roundCoordinate) as Bounds;
}

/**
 * O retângulo que o quadro mostra depois de `map.fitBounds(bounds, { padding,
 * maxZoom })`, calculado sem mapa: o mesmo zoom e o mesmo centro, só que
 * estendido até as bordas do quadro.
 *
 * @example
 * fitFrameBounds([-36.1, -7.4, -35.8, -7.1], { width: 696, height: 322 }, 36);
 */
export function fitFrameBounds(
  [west, south, east, north]: Bounds,
  frame: { width: number; height: number },
  padding: number,
  maxZoom = Infinity,
): Bounds {
  const southWest = project(west, south);
  const northEast = project(east, north);
  const spanX = Math.max(northEast.x - southWest.x, 1e-12);
  const spanY = Math.max(southWest.y - northEast.y, 1e-12);
  const scale = Math.min(
    2 ** maxZoom,
    (frame.width - 2 * padding) / (spanX * WORLD_SIZE_PX),
    (frame.height - 2 * padding) / (spanY * WORLD_SIZE_PX),
  );
  const halfWidth = frame.width / 2 / (scale * WORLD_SIZE_PX);
  const halfHeight = frame.height / 2 / (scale * WORLD_SIZE_PX);
  const centerX = (southWest.x + northEast.x) / 2;
  const centerY = (southWest.y + northEast.y) / 2;

  return toDegrees(
    centerX - halfWidth,
    centerY - halfHeight,
    centerX + halfWidth,
    centerY + halfHeight,
  );
}

/** O quadro com a folga da miniatura, ainda em linha reta no Web Mercator. */
function withMargin([west, south, east, north]: Bounds): Bounds {
  const southWest = project(west, south);
  const northEast = project(east, north);
  const marginX = (northEast.x - southWest.x) * REPORT_MAP_IMAGE_MARGIN;
  const marginY = (southWest.y - northEast.y) * REPORT_MAP_IMAGE_MARGIN;

  return toDegrees(
    southWest.x - marginX,
    northEast.y - marginY,
    northEast.x + marginX,
    southWest.y + marginY,
  );
}

/**
 * O recorte dos mapas do relatório de um município, com o mesmo enquadramento
 * que o mapa usava ao focá-lo: folga de 36 px e zoom máximo.
 *
 * Os outros recortes continuam em tiles. Numa imagem só, uma camada pesada
 * como a cobertura da terra levava 23 s no Cerrado e estourava a memória do
 * Earth Engine no Brasil, enquanto em tiles, calculados em paralelo, leva 8 s.
 *
 * @example
 * resolveReportMapView(report.territory); // null fora de município
 */
export function resolveReportMapView(
  territory: MunicipalReportTerritory,
): ReportMapView | null {
  if (territory.level !== "municipality") return null;
  const bounds = getIndexedMunicipalityBounds(territory.locationKey);
  if (!bounds) return null;

  const [[west, south], [east, north]] = bounds as [
    [number, number],
    [number, number],
  ];
  const frame = fitFrameBounds(
    [west, south, east, north],
    REPORT_MAP_FRAME,
    REPORT_MAP_MUNICIPALITY_PADDING,
    MAP_MUNICIPALITY_FOCUS_MAX_ZOOM,
  );
  const width = REPORT_MAP_THUMBNAIL_WIDTH * (1 + 2 * REPORT_MAP_IMAGE_MARGIN);

  return {
    frame,
    thumbnail: {
      bbox: withMargin(frame),
      width: Math.round(width),
      height: Math.round(
        (width * REPORT_MAP_FRAME.height) / REPORT_MAP_FRAME.width,
      ),
    },
  };
}
