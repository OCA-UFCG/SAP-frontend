import { describe, expect, it } from "vitest";

describe("municipal availability index generation", () => {
  it("builds compact period ranges from converted municipal analysis data", async () => {
    // @ts-expect-error Pipeline modules are native ESM scripts without TS declarations.
    const { buildMunicipalAvailabilityIndex, toAvailabilityEntry } =
      await import(
        "../tools/drive-contentful-pipeline/lib/conversion/availability-index.mjs"
      );
    const conversion = {
      panelLayerId: "seca",
      layerKey: "ana",
      layerLabel: "Monitor de seca",
      territory: "municipality",
      imageData: {
        years: {
          "2024-01": { values: { "5200050": [1], "5200100": [2], BR: [3] } },
          "2024-02": { values: { "5200050": [1] } },
          "2025": { values: { "5200100": [2] } },
        },
      },
    };

    const index = buildMunicipalAvailabilityIndex([
      toAvailabilityEntry(conversion),
    ]);

    expect(index.layers).toEqual([
      {
        panelLayerId: "seca",
        layerKey: "ana",
        label: "Monitor de seca",
        order: 0,
        periods: ["2024-01", "2024-02", "2025"],
      },
    ]);
    expect(index.byMunicipality).toEqual({
      "5200050": { seca: "0-1" },
      "5200100": { seca: "0,2" },
    });
    expect(index.periodYears).toEqual(["2025", "2024"]);
  });
});
