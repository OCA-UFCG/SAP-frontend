import fs from "node:fs";
import sqlite3 from "sqlite3";
import { TileCoordinates, xyzToTmsY } from "./tileCoordinates";
import { getTileSetPath, TileSetConfig, TileSetId } from "./tileSets";

const databases = new Map<TileSetId, sqlite3.Database>();
let cleanupRegistered = false;

const closeDatabases = () => {
  databases.forEach((database) => database.close());
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
  const database = new sqlite3.Database(
    getTileSetPath(tileSet),
    sqlite3.OPEN_READONLY,
  );
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
): Promise<Buffer | null> => {
  const database = getTileDatabase(tileSet);
  const tmsY = xyzToTmsY(z, y);

  return new Promise((resolve, reject) => {
    database.get(
      "SELECT tile_data as tileData FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ? LIMIT 1",
      [z, x, tmsY],
      (err, row: { tileData?: Buffer } | undefined) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(row?.tileData ?? null);
      },
    );
  });
};
