import { describe, expect, it } from "vitest";

import enMessages from "@/translations/en/PlatformMapCaption.json";
import esMessages from "@/translations/es/PlatformMapCaption.json";
import ptMessages from "@/translations/pt/PlatformMapCaption.json";

const catalogs = [ptMessages, enMessages, esMessages];

describe("report class units", () => {
  it("keeps the soil-carbon class aliases labeled in g/kg", () => {
    const keys = [
      "menor-que-5",
      "menor-que5",
      "6-8",
      "8-10",
      "10-16",
      "maior-que-16",
      "maior-que16",
    ] as const;

    for (const catalog of catalogs) {
      for (const key of keys) {
        expect(catalog.PlatformMapCaption.labels[key]).toContain("g/kg");
      }
    }
  });

  it("keeps the precipitation-anomaly class aliases labeled in mm", () => {
    const keys = [
      "menor-que-90",
      "90-a-30",
      "30-a-0",
      "0-a-30",
      "30-a-90",
      "maior-que-90",
      "menor-que-90mm",
      "90-a-30mm",
      "30-a-0mm",
      "0-a-30mm",
      "30-a-90mm",
      "maior-que-90mm",
    ] as const;

    for (const catalog of catalogs) {
      for (const key of keys) {
        expect(catalog.PlatformMapCaption.labels[key]).toContain("mm");
      }
    }
  });
});
