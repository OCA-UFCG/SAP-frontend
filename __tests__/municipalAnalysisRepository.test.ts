import { describe, expect, it, vi } from "vitest";
import { gzipSync } from "node:zlib";

vi.mock("@/infrastructure/contentful/client", () => ({
  getContent: vi.fn(),
}));

import {
  decodeMunicipalAnalysisImageData,
  entryMatchesPartition,
  toDatasetPatch,
} from "@/repositories/platform/municipalAnalysisRepository";

function compressPayload(value: unknown) {
  const rawJson = JSON.stringify(value);

  return {
    type: "territorial-compact-compressed",
    encoding: "gzip+base64",
    data: gzipSync(Buffer.from(rawJson, "utf8")).toString("base64"),
  };
}

describe("municipalAnalysisRepository helpers", () => {
  it("decodes gzip+base64 municipal analysis payloads", () => {
    const decoded = decodeMunicipalAnalysisImageData(
      compressPayload({
        type: "territorial-compact",
        years: {
          "2026": {
            values: {
              "2914802": [80, 20],
            },
          },
        },
      }),
    );

    expect(decoded).toEqual({
      type: "territorial-compact",
      years: {
        "2026": {
          values: {
            "2914802": [80, 20],
          },
        },
      },
    });
  });

  it("drops invalid compressed payloads before merge", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(
      decodeMunicipalAnalysisImageData({
        type: "territorial-compact-compressed",
        encoding: "gzip+base64",
        data: "invalid",
      }),
    ).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      "municipalAnalysis comprimido inválido; entrada ignorada.",
      expect.any(Error),
    );

    warn.mockRestore();
  });

  it("converts imageData into a sanitized dataset patch", () => {
    expect(
      toDatasetPatch({
        schemaVersion: 1,
        type: "territorial-compact",
        defaultYear: "2026",
        classes: [{ id: "a", label: "A", color: "#111111" }],
        locations: {
          "2914802": "Itabuna - BA",
          invalid: 10,
        },
        templates: {
          municipality: "Municipio {name}",
        },
        ranking: {
          totalLabel: "municipios",
        },
        years: {
          "2026": {
            imageId: "ignored",
            valuesScale: 1,
            values: {
              "2914802": [80, 20],
              bad: ["80", 20],
            },
          },
          invalid: null,
        },
      }),
    ).toEqual({
      schemaVersion: 1,
      type: "territorial-compact",
      defaultYear: "2026",
      classes: [{ id: "a", label: "A", color: "#111111" }],
      templates: {
        municipality: "Municipio {name}",
      },
      ranking: {
        totalLabel: "municipios",
      },
      years: {
        "2026": {
          imageId: "ignored",
          valuesScale: 1,
        },
      },
    });
  });

  it("matches partitions by metadata or legacy standardized title", () => {
    expect(
      entryMatchesPartition(
        {
          sys: { id: "entry-1" },
          panelLayerId: "CDI_Test",
          partitionKey: "2026",
          title: "Outro titulo",
        },
        "CDI_Test",
        "2026",
      ),
    ).toBe(true);

    expect(
      entryMatchesPartition(
        {
          sys: { id: "entry-2" },
          panelLayerId: "CDI_Test",
          title: "Municipal Analysis CDI_Test 2026",
        },
        "CDI_Test",
        "2026",
      ),
    ).toBe(true);

    expect(
      entryMatchesPartition(
        {
          sys: { id: "entry-3" },
          panelLayerId: "terraibge",
          partitionKey: "2026",
          title: "Municipal Analysis terraibge 2026",
        },
        "CDI_Test",
        "2026",
      ),
    ).toBe(false);
  });
});
