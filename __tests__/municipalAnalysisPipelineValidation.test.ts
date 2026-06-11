import { describe, expect, it } from "vitest";
import { gzipSync } from "node:zlib";
import {
  validateMunicipalAnalysisImageData,
  validateMunicipalAnalysisManifest,
} from "../tools/drive-contentful-pipeline/contentful-update-municipal-analysis.mjs";

function compressImageData(imageData: unknown) {
  const compressed = gzipSync(Buffer.from(JSON.stringify(imageData), "utf8"));

  return compressed.toString("base64");
}

const validCompressedImageData = {
  type: "territorial-compact-compressed",
  encoding: "gzip+base64",
  data: [
    compressImageData({
      type: "territorial-compact",
      years: {},
    }),
  ],
};

const validPlainImageData = {
  type: "territorial-compact",
  years: {},
};

const validCompressedPatchImageData = {
  type: "territorial-compact-compressed",
  encoding: "gzip+base64",
  data: [
    compressImageData({
      templates: {
        municipality: "template",
      },
      years: {
        "2025": {
          valuesScale: 1,
          values: {
            "2507507": [1],
          },
        },
      },
    }),
  ],
};

describe("municipal analysis pipeline validation", () => {
  it("accepts compressed, plain and partition patch municipal analysis payloads", () => {
    expect(
      validateMunicipalAnalysisImageData(validCompressedImageData),
    ).toEqual([]);
    expect(validateMunicipalAnalysisImageData(validPlainImageData)).toEqual([]);
    expect(
      validateMunicipalAnalysisImageData(validCompressedPatchImageData),
    ).toEqual([]);
  });

  it("rejects imageData payloads without the expected contract", () => {
    expect(validateMunicipalAnalysisImageData({ type: "unexpected" })).toEqual([
      "imageData deve ter years ou ser envelope gzip+base64 territorial-compact-compressed.",
    ]);
  });

  it("rejects compressed imageData payloads that cannot be decoded", () => {
    expect(
      validateMunicipalAnalysisImageData({
        type: "territorial-compact-compressed",
        encoding: "gzip+base64",
        data: ["H4sI"],
      }),
    ).toEqual([expect.stringContaining("payload gzip+base64 inválido:")]);
  });

  it("validates manifest partitions, duplicate keys, files and payload shape", async () => {
    const readJsonFile = async (filePath: string) => {
      if (filePath.endsWith("invalid.json")) {
        return { type: "unexpected" };
      }

      if (filePath.endsWith("valid.json")) {
        return validCompressedImageData;
      }

      throw new Error("missing file");
    };
    const manifest = {
      partitions: [
        {
          panelLayerId: "CDI_Test",
          partitionKey: "2026",
          calendarYear: "2026",
          territory: "municipality",
          imageDataPath: "valid.json",
          yearKeys: ["2026"],
        },
        {
          panelLayerId: "CDI_Test",
          partitionKey: "2026",
          calendarYear: "2026",
          territory: "state",
          imageDataPath: "invalid.json",
          yearKeys: ["2026"],
        },
        {
          panelLayerId: "terraibge",
          partitionKey: "2025",
          calendarYear: "2025",
          territory: "municipality",
          imageDataPath: "missing.json",
          yearKeys: ["2025"],
        },
        {
          panelLayerId: "ods",
          partitionKey: "",
          calendarYear: "2024",
          territory: "municipality",
          imageDataPath: "valid.json",
          yearKeys: [],
        },
      ],
    };

    const validation = await validateMunicipalAnalysisManifest(
      manifest,
      "data/contentful-pipeline/json",
      readJsonFile,
    );

    expect(validation.ok).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "partitions[1]: partição ambígua para rota CDI_Test::2026; use partitionKey exclusivo por panelLayerId.",
        "partitions[1].imageData: imageData deve ter years ou ser envelope gzip+base64 territorial-compact-compressed.",
        "partitions[2].imageDataPath: não foi possível ler missing.json: missing file",
        "partitions[3].partitionKey: campo obrigatório ausente.",
        "partitions[3].yearKeys: deve ser uma lista não vazia de strings.",
      ]),
    );
  });
});
