import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import sqlite3 from "sqlite3";

export const runtime = "nodejs";

const MBTILES_RELATIVE_PATH = path.join(
  "public",
  "tiles",
  "brazil-states.mbtiles",
);

const isGzip = (buf: Buffer) =>
  buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;

let db: sqlite3.Database | null = null;

const getDb = () => {
  if (db) return db;

  const mbtilesPath = path.join(process.cwd(), MBTILES_RELATIVE_PATH);
  if (!fs.existsSync(mbtilesPath)) {
    // Keep db null; requests will return 404 with a clear message.
    return null;
  }

  sqlite3.verbose();
  db = new sqlite3.Database(mbtilesPath, sqlite3.OPEN_READONLY);

  // Best-effort cleanup for long-lived Node runtimes (docker / next start).
  process.once("SIGINT", () => {
    try {
      db?.close();
    } finally {
      db = null;
      process.exit(0);
    }
  });

  return db;
};

function toInt(value: string): number | null {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function xyzToTmsY(z: number, y: number) {
  return (1 << z) - 1 - y;
}

async function getTile(
  z: number,
  x: number,
  y: number,
): Promise<Buffer | null> {
  const database = getDb();
  if (!database) return null;

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
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const { z: zRaw, x: xRaw, y: yRaw } = await params;

  const z = toInt(zRaw);
  const x = toInt(xRaw);
  const y = toInt(yRaw);

  if (
    z === null ||
    x === null ||
    y === null ||
    z < 0 ||
    z > 22 ||
    x < 0 ||
    y < 0
  ) {
    return new Response("Invalid tile coordinates", { status: 400 });
  }

  try {
    const tileData = await getTile(z, x, y);
    if (!tileData) {
      const mbtilesPath = path.join(process.cwd(), MBTILES_RELATIVE_PATH);
      const message = fs.existsSync(mbtilesPath)
        ? "Tile not found"
        : `Missing MBTiles at ${MBTILES_RELATIVE_PATH}`;
      return new Response(message, { status: 404 });
    }

    const body = isGzip(tileData) ? tileData : gzipSync(tileData);

    // Next's Response typing expects web types; convert Node Buffer to Uint8Array.
    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        // Common content-type used by tile servers for MVT/PBF.
        "Content-Type": "application/vnd.mapbox-vector-tile",
        "Content-Encoding": "gzip",
        // Reasonable defaults; tune as needed (CDN/front proxy).
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("Tile server error:", err);
    return new Response("Tile server error", { status: 500 });
  }
}
