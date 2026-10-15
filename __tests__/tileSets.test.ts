import { describe, expect, it } from "vitest";
import { resolveTileSet } from "@/app/api/tiles/tileSets";

describe("tileSets", () => {
  it("defaults to the states tileset", () => {
    expect(resolveTileSet(null)).toEqual({
      ok: true,
      tileSet: expect.objectContaining({
        id: "states",
        relativePath: expect.stringContaining("brazil-states.mbtiles"),
      }),
    });
  });

  it("resolves the cities tileset", () => {
    expect(resolveTileSet("cities")).toEqual({
      ok: true,
      tileSet: expect.objectContaining({
        id: "cities",
        relativePath: expect.stringContaining("brazil-cities.mbtiles"),
      }),
    });
  });

  it("resolves the territories tileset", () => {
    expect(resolveTileSet("territories")).toEqual({
      ok: true,
      tileSet: expect.objectContaining({
        id: "territories",
        relativePath: expect.stringContaining("brazil-territories.mbtiles"),
      }),
    });
  });

  it("rejects unknown tilesets with the received value", () => {
    expect(resolveTileSet("neighborhoods")).toEqual({
      message:
        "Invalid tileset received neighborhoods; expected one of cities,states,territories",
      ok: false,
    });
  });
});
