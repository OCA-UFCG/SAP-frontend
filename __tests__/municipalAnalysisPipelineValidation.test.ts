import { describe, expect, it } from "vitest";
import { gzipSync } from "node:zlib";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  validateMunicipalAnalysisImageData,
  validateMunicipalAnalysisManifest,
} from "../tools/drive-contentful-pipeline/contentful-update-municipal-analysis.mjs";
import { normalizePipelineConfig } from "../tools/drive-contentful-pipeline/lib/config/pipeline-config.mjs";
import {
  parseCsv,
  toRows,
} from "../tools/drive-contentful-pipeline/lib/csv/csv-parser.mjs";
import { inferPanelLayerMapping } from "../tools/drive-contentful-pipeline/lib/csv/layer-mapping.mjs";
import {
  getLocation,
  inferTerritory,
} from "../tools/drive-contentful-pipeline/lib/csv/territory.mjs";
import { writeAnnualPartitions } from "../tools/drive-contentful-pipeline/lib/conversion/partition-writer.mjs";
import { patchEntryFields } from "../tools/drive-contentful-pipeline/lib/contentful/entries.mjs";
import {
  formatConversionSummary,
  summarizeConversionCoverage,
} from "../tools/drive-contentful-pipeline/lib/reporting/pipeline-summary.mjs";

function compressImageData(imageData: unknown) {
  const compressed = gzipSync(Buffer.from(JSON.stringify(imageData), "utf8"));

  return compressed.toString("base64");
}

const validCompressedImageData = {
  type: "territorial-compact-compressed",
  encoding: "gzip+base64",
  data: [
    compressImageData({
      years: {
        "2025": {
          values: {
            "2507507": [1],
          },
        },
      },
    }),
  ],
};

const validPlainImageData = {
  years: {
    "2025": {
      values: {
        "2507507": [1],
      },
    },
  },
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

const minimalPipelineConfig = normalizePipelineConfig({
  schemaVersion: 1,
  drive: { folderId: "folder" },
  paths: { csvDir: "csv", jsonDir: "json" },
  limits: { maxContentfulJsonBytes: 450000, compressedDataChunkSize: 20 },
  defaults: {
    fileNamePattern: "\\.csv$",
    municipalityTemplate: "municipality",
    stateTemplate: "state",
  },
  layerRules: [
    {
      key: "cdi",
      label: "CDI",
      panelLayerId: "CDI_Test",
      patterns: ["(^|[-_\\s])cdi($|[-_\\s])"],
    },
  ],
  panelLayerProfiles: {
    CDI_Test: {
      classes: [{ id: "a", label: "A", color: "#000000" }],
      templates: { municipality: "template" },
      mapVisualization: { sourceType: "image" },
    },
  },
});

class FakeContentfulFetch {
  calls: Array<{ url: string; init: RequestInit }> = [];

  constructor(private readonly responses: unknown[]) {}

  install() {
    const fakeFetch = async (url: string | URL, init: RequestInit = {}) => {
      this.calls.push({ url: String(url), init });
      const body = this.responses.shift();

      return new Response(JSON.stringify(body), { status: 200 });
    };

    global.fetch = fakeFetch as typeof fetch;
  }
}

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

  it("normalizes pipeline config and maps CSV filenames with compiled patterns", () => {
    expect(minimalPipelineConfig.fileNamePattern.test("input.csv")).toBe(true);
    expect(
      inferPanelLayerMapping(
        "Estatisticas_SAP_Municipios_CDI_2026.csv",
        minimalPipelineConfig.layerRules,
      ),
    ).toMatchObject({
      layerKey: "cdi",
      panelLayerId: "CDI_Test",
      mappingRule: "(^|[-_\\s])cdi($|[-_\\s])",
    });
  });

  it("reports invalid declarative regex with the offending value", () => {
    expect(() =>
      normalizePipelineConfig({
        ...minimalPipelineConfig,
        layerRules: [
          {
            key: "bad",
            label: "Bad",
            panelLayerId: "bad",
            patterns: ["["],
          },
        ],
      }),
    ).toThrow('layerRules[0].patterns[0] contém regex inválida "["');
  });

  it("rejects unknown pipeline config schema versions", () => {
    expect(() =>
      normalizePipelineConfig({
        ...minimalPipelineConfig,
        schemaVersion: 2,
      }),
    ).toThrow("schemaVersion deve ser 1; recebido 2.");
  });

  it("parses quoted CSV rows and validates row width", () => {
    expect(parseCsv('name,value\n"A, B",1\n')).toEqual([
      ["name", "value"],
      ["A, B", "1"],
    ]);
    expect(() => toRows("a,b\n1\n")).toThrow(
      "Linha 2 com 1 colunas; esperado 2.",
    );
  });

  it("infers municipality and state territories from CSV columns", () => {
    expect(
      inferTerritory({
        CD_MUN: "2507507",
        NM_MUN: "João Pessoa",
        SIGLA_UF: "PB",
      }),
    ).toBe("municipality");
    expect(
      getLocation(
        { CD_MUN: "2507507", NM_MUN: "João Pessoa", SIGLA_UF: "PB" },
        "municipality",
      ),
    ).toEqual({ key: "2507507", label: "João Pessoa - PB" });
    expect(inferTerritory({ SIGLA_UF: "PB", NM_UF: "Paraíba" })).toBe("state");
  });

  it("writes compressed annual partitions and blocks ambiguous route keys", async () => {
    const partitionDir = path.join("/tmp", `sap-partitions-${Date.now()}`);
    await mkdir(partitionDir, { recursive: true });

    try {
      const conversion = {
        inputPath: "source.csv",
        territory: "municipality",
        imageData: {
          templates: { municipality: "template" },
          years: {
            "2026": { valuesScale: 1, values: { "2507507": [1] } },
          },
        },
        locationCount: 1,
      };
      const group = {
        panelLayerId: "CDI_Test",
        layerKey: "cdi",
        layerLabel: "CDI",
        sourceCsvPaths: ["source.csv"],
      };
      const partitions = await writeAnnualPartitions(
        conversion,
        group,
        partitionDir,
        new Set(),
        { maxContentfulJsonBytes: 450000, writeRawPartitions: false },
        minimalPipelineConfig,
      );
      const payload = JSON.parse(
        await readFile(partitions[0].outputPath, "utf8"),
      );

      expect(partitions[0]).toMatchObject({
        panelLayerId: "CDI_Test",
        partitionKey: "2026",
        encoding: "gzip+base64",
      });
      expect(payload.data.length).toBeGreaterThan(1);
    } finally {
      await rm(partitionDir, { recursive: true, force: true });
    }
  });

  it("patches localized Contentful fields through the shared entry client", async () => {
    const fakeFetch = new FakeContentfulFetch([
      { sys: { id: "entry", version: 7 }, fields: {} },
      { sys: { id: "entry", version: 8 } },
      { sys: { id: "entry", version: 9, publishedAt: "now" } },
    ]);
    fakeFetch.install();

    const updated = await patchEntryFields(
      {
        spaceId: "space",
        environment: "master",
        managementToken: "token",
      },
      { sys: { id: "entry" } },
      { imageData: { years: {} } },
      "en-US",
      true,
      "test",
    );

    expect(updated.sys.publishedAt).toBe("now");
    expect(JSON.parse(String(fakeFetch.calls[1].init.body))).toEqual([
      {
        op: "add",
        path: "/fields/imageData",
        value: { "en-US": { years: {} } },
      },
    ]);
  });

  it("formats concise conversion coverage summaries", () => {
    const report = {
      validation: { ok: true, ignoredSkippedCsvs: [] },
      convertedFiles: 2,
      panelLayerFiles: 1,
      partitionFiles: 2,
      partitionFilesDetails: [
        {
          panelLayerId: "CDI_Test",
          yearKeys: ["2024-01"],
          outputBytes: 1024,
        },
        {
          panelLayerId: "CDI_Test",
          yearKeys: ["2024-02"],
          outputBytes: 2048,
        },
      ],
    };

    expect(summarizeConversionCoverage(report)).toEqual([
      {
        panelLayerId: "CDI_Test",
        partitions: 2,
        years: "2024-01..2024-02",
        outputMb: 0,
      },
    ]);
    expect(formatConversionSummary(report)).toContain("Conversion summary");
    expect(formatConversionSummary(report)).toContain("CDI_Test");
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
