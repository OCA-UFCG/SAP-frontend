import path from "node:path";

export type TileSetId = "cities" | "states" | "territories";

export interface TileSetConfig {
  id: TileSetId;
  relativePath: string;
}

interface ValidTileSet {
  ok: true;
  tileSet: TileSetConfig;
}

interface InvalidTileSet {
  message: string;
  ok: false;
}

type TileSetResult = InvalidTileSet | ValidTileSet;

const TILE_SETS: Record<TileSetId, TileSetConfig> = {
  cities: {
    id: "cities",
    relativePath: path.join("public", "tiles", "brazil-cities.mbtiles"),
  },
  states: {
    id: "states",
    relativePath: path.join("public", "tiles", "brazil-states.mbtiles"),
  },
  // Gerado por scripts/build-territory-tiles.mjs.
  territories: {
    id: "territories",
    relativePath: path.join("public", "tiles", "brazil-territories.mbtiles"),
  },
};

const isTileSetId = (value: string): value is TileSetId =>
  Object.hasOwn(TILE_SETS, value);

export const resolveTileSet = (rawTileSet: string | null): TileSetResult => {
  if (!rawTileSet) {
    return { ok: true, tileSet: TILE_SETS.states };
  }

  if (!isTileSetId(rawTileSet)) {
    return {
      ok: false,
      message: `Invalid tileset received ${rawTileSet}; expected one of ${Object.keys(TILE_SETS).join(",")}`,
    };
  }

  return { ok: true, tileSet: TILE_SETS[rawTileSet] };
};

export const getTileSetPath = (tileSet: TileSetConfig) =>
  path.join(process.cwd(), tileSet.relativePath);
