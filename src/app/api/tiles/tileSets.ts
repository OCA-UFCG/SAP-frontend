import path from "node:path";
import territoryVectorTiles from "@/config/territoryVectorTiles.json";

export type TileSetId = "cities" | "states" | `territories-${string}`;

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
  // Um arquivo por grupo de Territórios, de scripts/build-territory-tiles.mjs:
  // quem liga um grupo só baixa os tiles dele.
  ...Object.fromEntries(
    territoryVectorTiles.layers.map((layerId) => [
      `territories-${layerId}`,
      {
        id: `territories-${layerId}`,
        relativePath: path.join(
          "public",
          "tiles",
          `brazil-territories-${layerId}.mbtiles`,
        ),
      },
    ]),
  ),
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
