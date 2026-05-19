import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { TileCoordinates, xyzToTmsY } from "./tileCoordinates";
import { getTileSetPath, TileSetConfig, TileSetId } from "./tileSets";

const databases = new Map<TileSetId, DatabaseSync>();
let cleanupRegistered = false;

const closeDatabases = () => {
  databases.forEach((database) => {
    try {
      database.close();
    } catch {
      // Ignore close errors during process shutdown.
    }
  });
  databases.clear();
};

const registerCleanup = () => {
  if (cleanupRegistered) return;
  cleanupRegistered = true;

  process.once("SIGINT", () => {
    closeDatabases();
    process.exit(0);
  });
};

export const tileSetFileExists = (tileSet: TileSetConfig) =>
  fs.existsSync(getTileSetPath(tileSet));

const openTileDatabase = (tileSet: TileSetConfig) => {
  const database = new DatabaseSync(getTileSetPath(tileSet), {
    open: true,
    readOnly: true,
  });
  databases.set(tileSet.id, database);
  registerCleanup();
  return database;
};

const getTileDatabase = (tileSet: TileSetConfig) => {
  return databases.get(tileSet.id) ?? openTileDatabase(tileSet);
};

export const readVectorTile = (
  tileSet: TileSetConfig,
  { x, y, z }: TileCoordinates,
): Buffer | null => {
  const database = getTileDatabase(tileSet);
  const tmsY = xyzToTmsY(z, y);

  const row = database
    .prepare(
      "SELECT tile_data as tileData FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ? LIMIT 1",
    )
    .get(z, x, tmsY) as
    | { tileData?: Buffer | Uint8Array<ArrayBufferLike> }
    | undefined;

  if (!row?.tileData) return null;

  return Buffer.isBuffer(row.tileData)
    ? row.tileData
    : Buffer.from(row.tileData);
};
