import { describe, expect, it } from "vitest";
import {
  parseTileCoordinates,
  xyzToTmsY,
} from "@/app/api/tiles/tileCoordinates";

describe("tileCoordinates", () => {
  it("parses valid tile coordinates", () => {
    expect(parseTileCoordinates("7", "42", "55")).toEqual({
      coordinates: { x: 42, y: 55, z: 7 },
      ok: true,
    });
  });

  it("rejects invalid coordinate values with the received value", () => {
    expect(parseTileCoordinates("23", "0", "0")).toEqual({
      message:
        "Invalid tile coordinates received z=23, x=0, y=0; expected z 0-22 and x/y >= 0",
      ok: false,
    });
  });

  it("converts xyz y coordinates to tms", () => {
    expect(xyzToTmsY(3, 2)).toBe(5);
  });
});
