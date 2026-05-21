import { gzipSync } from "node:zlib";
import { parseTileCoordinates } from "../../../tileCoordinates";
import { readVectorTile, tileSetFileExists } from "../../../tileDatabase";
import { resolveTileSet } from "../../../tileSets";
import { requireAuthenticatedRequest } from "@/lib/server-session";

export const runtime = "nodejs";

const isGzip = (buf: Buffer) =>
  buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;

const buildTileResponse = (tileData: Buffer) => {
  const body = isGzip(tileData) ? tileData : gzipSync(tileData);

  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Encoding": "gzip",
      "Content-Type": "application/vnd.mapbox-vector-tile",
    },
  });
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const unauthorizedResponse = await requireAuthenticatedRequest(request);
  if (unauthorizedResponse) return unauthorizedResponse;

  const { z: zRaw, x: xRaw, y: yRaw } = await params;
  const tileSetParam = new URL(request.url).searchParams.get("tileset");
  const tileSetResult = resolveTileSet(tileSetParam);

  if (!tileSetResult.ok) {
    return new Response(tileSetResult.message, { status: 400 });
  }

  const coordinatesResult = parseTileCoordinates(zRaw, xRaw, yRaw);
  if (!coordinatesResult.ok) {
    return new Response(coordinatesResult.message, { status: 400 });
  }

  const tileSet = tileSetResult.tileSet;

  try {
    if (!tileSetFileExists(tileSet)) {
      return new Response(`Missing MBTiles at ${tileSet.relativePath}`, {
        status: 404,
      });
    }

    const tileData = await readVectorTile(
      tileSet,
      coordinatesResult.coordinates,
    );
    return tileData
      ? buildTileResponse(tileData)
      : new Response("Tile not found", { status: 404 });
  } catch (err) {
    console.error("Tile server error:", err);
    return new Response("Tile server error", { status: 500 });
  }
}
