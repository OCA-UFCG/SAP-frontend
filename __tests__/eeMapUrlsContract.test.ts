import { describe, expect, it } from "vitest";
import {
  buildEeMapUrlKey,
  EE_MAP_URLS_MAX_ITEMS,
  parseEeMapUrlRequest,
} from "@/contracts/eeMapUrls";

describe("parseEeMapUrlRequest", () => {
  it("accepts a list of layer and period pairs", () => {
    const parsed = parseEeMapUrlRequest({
      maps: [
        { name: "anaseca", year: "2024-12" },
        { name: " deg ", year: " 2021 " },
      ],
    });

    expect(parsed).toEqual({
      ok: true,
      items: [
        { name: "anaseca", year: "2024-12" },
        { name: "deg", year: "2021" },
      ],
    });
  });

  it("drops repeated pairs so one Earth Engine call costs one slot", () => {
    const parsed = parseEeMapUrlRequest({
      maps: [
        { name: "anaseca", year: "2024-12" },
        { name: "anaseca", year: "2024-12" },
      ],
    });

    expect(parsed.ok && parsed.items).toEqual([
      { name: "anaseca", year: "2024-12" },
    ]);
  });

  it("rejects a body without maps naming what it received", () => {
    const parsed = parseEeMapUrlRequest({ layers: [] });

    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.error).toContain("maps");
  });

  it("rejects an entry that is missing the period", () => {
    const parsed = parseEeMapUrlRequest({
      maps: [{ name: "anaseca", year: "2024" }, { name: "deg" }],
    });

    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.error).toContain("index 1");
  });

  it("rejects more pairs than a single request may resolve", () => {
    const maps = Array.from({ length: EE_MAP_URLS_MAX_ITEMS + 1 }, (_, i) => ({
      name: `layer-${i}`,
      year: "2024",
    }));

    const parsed = parseEeMapUrlRequest({ maps });

    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.error).toContain(
      String(EE_MAP_URLS_MAX_ITEMS),
    );
  });

  it("builds the same key the report uses for a layer and period", () => {
    expect(buildEeMapUrlKey("anaseca", "2024-12")).toBe("anaseca:2024-12");
  });

  it("accepts a thumbnail view next to the layers", () => {
    const thumbnail = {
      bbox: [-36.4, -7.6, -35.6, -7.1],
      width: 1448,
      height: 670,
    };

    expect(
      parseEeMapUrlRequest({
        maps: [{ name: "anaseca", year: "2024-12" }],
        thumbnail,
      }),
    ).toEqual({
      ok: true,
      items: [{ name: "anaseca", year: "2024-12" }],
      thumbnail,
    });
  });

  it.each([
    [
      "west after east",
      { bbox: [-35, -7.6, -36, -7.1], width: 10, height: 10 },
    ],
    [
      "beyond Web Mercator",
      { bbox: [-36, -89, -35, -7], width: 10, height: 10 },
    ],
    ["a side too large", { bbox: [-36, -8, -35, -7], width: 4096, height: 10 }],
    [
      "a fractional side",
      { bbox: [-36, -8, -35, -7], width: 10.5, height: 10 },
    ],
    ["a missing corner", { bbox: [-36, -8, -35], width: 10, height: 10 }],
  ])("rejects a thumbnail with %s", (_case, thumbnail) => {
    const parsed = parseEeMapUrlRequest({
      maps: [{ name: "anaseca", year: "2024-12" }],
      thumbnail,
    });

    expect(parsed.ok).toBe(false);
  });
});
