export interface TileCoordinates {
  x: number;
  y: number;
  z: number;
}

interface ValidTileCoordinates {
  coordinates: TileCoordinates;
  ok: true;
}

interface InvalidTileCoordinates {
  message: string;
  ok: false;
}

type TileCoordinatesResult = InvalidTileCoordinates | ValidTileCoordinates;

interface ParsedTileCoordinates {
  x: number | null;
  y: number | null;
  z: number | null;
}

const toCoordinateInteger = (value: string): number | null => {
  const coordinate = Number.parseInt(value, 10);
  return Number.isFinite(coordinate) ? coordinate : null;
};

const buildCoordinateMessage = (zRaw: string, xRaw: string, yRaw: string) =>
  `Invalid tile coordinates received z=${zRaw}, x=${xRaw}, y=${yRaw}; expected z 0-22 and x/y >= 0`;

const hasParsedCoordinates = (
  coordinates: ParsedTileCoordinates,
): coordinates is TileCoordinates =>
  coordinates.x !== null && coordinates.y !== null && coordinates.z !== null;

const isValidTileCoordinate = ({ x, y, z }: TileCoordinates) =>
  z >= 0 && z <= 22 && x >= 0 && y >= 0;

export const parseTileCoordinates = (
  zRaw: string,
  xRaw: string,
  yRaw: string,
): TileCoordinatesResult => {
  const coordinates = {
    x: toCoordinateInteger(xRaw),
    y: toCoordinateInteger(yRaw),
    z: toCoordinateInteger(zRaw),
  };

  if (!hasParsedCoordinates(coordinates)) {
    return {
      ok: false,
      message: buildCoordinateMessage(zRaw, xRaw, yRaw),
    };
  }

  if (!isValidTileCoordinate(coordinates)) {
    return {
      ok: false,
      message: buildCoordinateMessage(zRaw, xRaw, yRaw),
    };
  }

  return { coordinates, ok: true };
};

export const xyzToTmsY = (z: number, y: number) => (1 << z) - 1 - y;
