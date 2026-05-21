import { beforeEach, describe, expect, it, vi } from "vitest";

const { readVectorTileMock, tileSetFileExistsMock } = vi.hoisted(() => ({
  readVectorTileMock: vi.fn(),
  tileSetFileExistsMock: vi.fn(),
}));

vi.mock("@/app/api/tiles/tileDatabase", () => ({
  readVectorTile: readVectorTileMock,
  tileSetFileExists: tileSetFileExistsMock,
}));

import { GET } from "@/app/api/tiles/[z]/[x]/[y]/route";

const callTilesRoute = (url: string) =>
  GET(new Request(url), {
    params: Promise.resolve({ x: "0", y: "0", z: "0" }),
  });

describe("tiles route", () => {
  beforeEach(() => {
    readVectorTileMock.mockReset();
    tileSetFileExistsMock.mockReset();
    tileSetFileExistsMock.mockReturnValue(true);
    readVectorTileMock.mockResolvedValue(Buffer.from([1, 2, 3]));
  });

  it("serves base boundary tiles without requiring a session", async () => {
    const response = await callTilesRoute(
      "https://example.test/api/tiles/0/0/0",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=86400, stale-while-revalidate=604800",
    );
    expect(readVectorTileMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "states" }),
      { x: 0, y: 0, z: 0 },
    );
  });

  it("uses states as the default tileset", async () => {
    const response = await callTilesRoute(
      "https://example.test/api/tiles/0/0/0",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=86400, stale-while-revalidate=604800",
    );
    expect(readVectorTileMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "states" }),
      { x: 0, y: 0, z: 0 },
    );
  });

  it("uses the cities tileset when requested", async () => {
    const response = await callTilesRoute(
      "https://example.test/api/tiles/0/0/0?tileset=cities",
    );

    expect(response.status).toBe(200);
    expect(readVectorTileMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "cities" }),
      { x: 0, y: 0, z: 0 },
    );
  });

  it("rejects invalid tilesets", async () => {
    const response = await callTilesRoute(
      "https://example.test/api/tiles/0/0/0?tileset=roads",
    );

    await expect(response.text()).resolves.toContain(
      "Invalid tileset received roads",
    );
    expect(response.status).toBe(400);
    expect(readVectorTileMock).not.toHaveBeenCalled();
  });
});
