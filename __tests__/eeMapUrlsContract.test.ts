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
});
