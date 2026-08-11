import { describe, expect, it } from "vitest";
import { gzipSync } from "node:zlib";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
  getMultilevelPanelLayerLocation,
  inferTerritory,
} from "../tools/drive-contentful-pipeline/lib/csv/territory.mjs";
import { writeAnnualPartitions } from "../tools/drive-contentful-pipeline/lib/conversion/partition-writer.mjs";
import { convertPanelLayerCsvFile } from "../tools/drive-contentful-pipeline/lib/conversion/panel-layer-converter.mjs";
import { convertCsvDirectory } from "../tools/drive-contentful-pipeline/lib/conversion/output-files.mjs";
import { writeDriveCsvSnapshot } from "../tools/drive-contentful-pipeline/lib/drive/drive-snapshot.mjs";
import { assertUniqueDriveLocalNames } from "../tools/drive-contentful-pipeline/lib/drive/drive-client.mjs";
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

async function writeTestDriveSnapshot(
  csvDir: string,
  files: Array<{ localName: string; modifiedTime: string }>,
) {
  await writeDriveCsvSnapshot(
    csvDir,
    "test-folder",
    files.map((file, index) => ({
      id: `file-${index}`,
      name: file.localName,
      localName: file.localName,
      mimeType: "text/csv",
      modifiedTime: file.modifiedTime,
      size: "1",
    })),
  );
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
        "Estatisticas_SEDES_Municipios_CDI_2026.csv",
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

  it("infers multilevel forecast territory from NIVEL_AGRUPAMENTO rows", () => {
    const row = {
      NIVEL_AGRUPAMENTO: "7_Municipio",
      NOME_LOCAL: "João Pessoa",
      CD_MUN: "2507507",
      NM_UF: "Paraíba",
    };

    expect(inferTerritory(row)).toBe("multilevel");
    expect(getLocation(row, "multilevel")).toEqual({
      key: "2507507",
      label: "João Pessoa - PB",
    });
    expect(
      getLocation(
        { NIVEL_AGRUPAMENTO: "1_BR", NOME_LOCAL: "Brasil Total" },
        "multilevel",
      ),
    ).toEqual({ key: "br", label: "Brasil" });
  });

  it.each([
    [
      {
        NIVEL_AGRUPAMENTO: "2_Regiao",
        NOME_LOCAL: "Centro-oeste",
        NM_REGIAO: "Centro-oeste",
      },
      "2_regiao-centro-oeste",
    ],
    [
      {
        NIVEL_AGRUPAMENTO: "3_Bioma",
        NOME_LOCAL: "Mata Atlântica",
        BIOMA_PRED: "Mata Atlântica",
      },
      "3_bioma-mata-atlantica",
    ],
    [
      {
        NIVEL_AGRUPAMENTO: "4_ASD",
        NOME_LOCAL: "Apenas ASD",
        ASD_ENTORN: "ASD",
      },
      "4_asd-apenas-asd",
    ],
    [
      {
        NIVEL_AGRUPAMENTO: "4_ASD",
        NOME_LOCAL: "ASD + Entorno",
        ASD_ENTORN: "ASD + Entorno",
      },
      "4_asd-asd-entorno",
    ],
    [
      {
        NIVEL_AGRUPAMENTO: "5_Semiarido",
        NOME_LOCAL: "Semiárido Total",
        SEMIÁRIDO: "Sim",
      },
      "5_semiarido-semiarido-total",
    ],
  ])("uses NIVEL_AGRUPAMENTO + NOME_LOCAL as the key contract", (row, key) => {
    expect(getLocation(row, "multilevel")).toEqual({
      key,
      label: row.NOME_LOCAL,
    });
  });

  it("keeps aggregate rows and excludes municipalities from panelLayer", () => {
    expect(
      getMultilevelPanelLayerLocation({
        NIVEL_AGRUPAMENTO: "4_ASD",
        NOME_LOCAL: "ASD + Entorno",
      }),
    ).toEqual({
      key: "4_asd-asd-entorno",
      label: "ASD + Entorno",
    });

    expect(
      getMultilevelPanelLayerLocation({
        NIVEL_AGRUPAMENTO: "7_Municipio",
        NOME_LOCAL: "João Pessoa",
        CD_MUN: "2507507",
        SIGLA_UF: "PB",
      }),
    ).toBeNull();
  });

  it.each([
    {
      fileName: "Estatistica_Multinivel_MonitorANA_2026.csv",
      panelLayerId: "anaseca",
      pattern: "ana",
      rows: ["1_BR,Brasil Total,2026,6,2026-06-01,100"],
      expectedYear: "2026-06",
      expectedImageId:
        "projects/ee-ulissesalencar17/assets/IC_monitor_seca_ANA/monitor_ana_2026_06",
    },
    {
      fileName: "Estatisticas_SAP_Multinivel_Prev_P_Cal_Anomalia_20260701.csv",
      panelLayerId: "prev_anomalia_precipitacao",
      pattern: "prev",
      rows: [
        "1_BR,Brasil Total,2026,8,2026-08-01,100",
        "1_BR,Brasil Total,2026,9,2026-09-01,100",
        "1_BR,Brasil Total,2026,10,2026-10-01,100",
        "1_BR,Brasil Total,2026,11,2026-11-01,100",
      ],
      expectedYear: "2026-11",
      expectedImageId:
        "projects/ee-ulissesalencar17/assets/previsao_P_cal_20260701_04",
    },
  ])(
    "infers image IDs for recent multilevel $panelLayerId files",
    async ({
      fileName,
      panelLayerId,
      pattern,
      rows,
      expectedYear,
      expectedImageId,
    }) => {
      const rootDir = path.join("/tmp", `sedes-image-id-${Date.now()}`);
      const inputPath = path.join(rootDir, fileName);
      const config = normalizePipelineConfig({
        schemaVersion: 1,
        drive: { folderId: "folder" },
        paths: { csvDir: "csv", jsonDir: "json" },
        limits: {
          maxContentfulJsonBytes: 450000,
          compressedDataChunkSize: 30000,
        },
        defaults: {
          fileNamePattern: "\\.csv$",
          municipalityTemplate: "municipality",
          stateTemplate: "state",
        },
        layerRules: [
          {
            key: pattern,
            label: pattern,
            panelLayerId,
            patterns: [pattern],
          },
        ],
        panelLayerProfiles: {
          [panelLayerId]: {
            classes: [{ id: "a", label: "A", color: "#000000" }],
            templates: { state: "state" },
            mapVisualization: { sourceType: "image" },
          },
        },
      });
      await mkdir(rootDir, { recursive: true });

      try {
        await writeFile(
          inputPath,
          [
            "NIVEL_AGRUPAMENTO,NOME_LOCAL,ano,mes,data_img,perc_classe_0",
            ...rows,
          ].join("\n"),
          "utf8",
        );

        const conversion = await convertPanelLayerCsvFile(inputPath, config);

        expect(conversion.imageData.years[expectedYear].imageId).toBe(
          expectedImageId,
        );
      } finally {
        await rm(rootDir, { recursive: true, force: true });
      }
    },
  );

  it("merges legacy and multilevel forecast CSVs into one annual partition", async () => {
    const rootDir = path.join("/tmp", `sedes-multilevel-${Date.now()}`);
    const csvDir = path.join(rootDir, "csv");
    const jsonDir = path.join(rootDir, "json");
    await mkdir(csvDir, { recursive: true });

    try {
      await writeFile(
        path.join(csvDir, "Estatisticas_SEDES_Municipios_CDI_2026.csv"),
        [
          "CD_MUN,NM_MUN,SIGLA_UF,ano,data_img,perc_classe_0,perc_classe_1",
          "2507507,João Pessoa,PB,2026,2026-01-01,10,90",
          "2507507,João Pessoa,PB,2026,2026-02-01,20,80",
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(csvDir, "Estatisticas_SEDES_Multinivel_CDI_2026.csv"),
        [
          "NIVEL_AGRUPAMENTO,NOME_LOCAL,CD_MUN,NM_UF,ano,mes,data_img,perc_classe_0,perc_classe_1",
          "1_BR,Brasil Total,---,---,2026,2,2026-02-01,30,70",
          "7_Municipio,João Pessoa,2507507,Paraíba,2026,2,2026-02-01,40,60",
        ].join("\n"),
        "utf8",
      );
      await writeTestDriveSnapshot(csvDir, [
        {
          localName: "Estatisticas_SEDES_Municipios_CDI_2026.csv",
          modifiedTime: "2026-06-01T10:00:00.000Z",
        },
        {
          localName: "Estatisticas_SEDES_Multinivel_CDI_2026.csv",
          modifiedTime: "2026-06-02T10:00:00.000Z",
        },
      ]);

      const result = await convertCsvDirectory(
        {
          csvDir,
          jsonDir,
          fileNamePattern: /\.csv$/iu,
          writeAggregates: false,
          writeRawPartitions: true,
          maxContentfulJsonBytes: 450000,
        },
        minimalPipelineConfig,
      );
      const partition = result.partitionFiles.find(
        (file) => file.panelLayerId === "CDI_Test",
      );
      const payload = JSON.parse(await readFile(partition.outputPath, "utf8"));

      expect(result.partitionFiles).toHaveLength(1);
      expect(partition).toMatchObject({
        panelLayerId: "CDI_Test",
        partitionKey: "2026",
        territory: "multilevel",
        yearKeys: ["2026-01", "2026-02"],
      });
      expect(payload.years["2026-01"].values["2507507"]).toEqual([10, 90]);
      expect(payload.years["2026-02"].values.br).toEqual([30, 70]);
      expect(payload.years["2026-02"].values["2507507"]).toEqual([40, 60]);
      expect(result.skipped.find((item) => item.collision)).toMatchObject({
        inputPath: expect.stringContaining(
          "Estatisticas_SEDES_Municipios_CDI_2026.csv",
        ),
        ignored: true,
        collision: {
          yearKey: "2026-02",
          winnerModifiedTime: "2026-06-02T10:00:00.000Z",
          loserModifiedTime: "2026-06-01T10:00:00.000Z",
        },
      });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("uses Drive modifiedTime instead of calibration or location coverage", async () => {
    const rootDir = path.join("/tmp", `sedes-modified-time-${Date.now()}`);
    const csvDir = path.join(rootDir, "csv");
    const jsonDir = path.join(rootDir, "json");
    const olderName = "Estatisticas_SEDES_Municipios_CDI_Cal_20260601.csv";
    const newerName = "Estatisticas_SEDES_Municipios_CDI_Cal_20260401.csv";
    await mkdir(csvDir, { recursive: true });

    try {
      await writeFile(
        path.join(csvDir, olderName),
        [
          "CD_MUN,NM_MUN,SIGLA_UF,ano,data_img,perc_classe_0,perc_classe_1",
          "2507507,João Pessoa,PB,2026,2026-02-01,10,90",
          "3550308,São Paulo,SP,2026,2026-02-01,20,80",
          "2507507,João Pessoa,PB,2026,2026-03-01,30,70",
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(csvDir, newerName),
        [
          "CD_MUN,NM_MUN,SIGLA_UF,ano,data_img,perc_classe_0,perc_classe_1",
          "2507507,João Pessoa,PB,2026,2026-02-01,99,1",
        ].join("\n"),
        "utf8",
      );
      await writeTestDriveSnapshot(csvDir, [
        { localName: olderName, modifiedTime: "2026-06-10T10:00:00.000Z" },
        { localName: newerName, modifiedTime: "2026-07-10T10:00:00.000Z" },
      ]);

      const result = await convertCsvDirectory(
        {
          csvDir,
          jsonDir,
          fileNamePattern: /\.csv$/iu,
          writeAggregates: false,
          writeRawPartitions: true,
          maxContentfulJsonBytes: 450000,
        },
        minimalPipelineConfig,
      );
      const partition = result.partitionFiles[0];
      const payload = JSON.parse(await readFile(partition.outputPath, "utf8"));

      expect(payload.years["2026-02"].values).toEqual({
        "2507507": [99, 1],
      });
      expect(payload.years["2026-03"].values["2507507"]).toEqual([30, 70]);
      expect(result.skipped[0].collision).toMatchObject({
        winnerInputPath: expect.stringContaining(newerName),
        loserInputPath: expect.stringContaining(olderName),
      });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("applies Drive modifiedTime to panelLayer collisions", async () => {
    const rootDir = path.join("/tmp", `sedes-panel-modified-${Date.now()}`);
    const csvDir = path.join(rootDir, "csv");
    const jsonDir = path.join(rootDir, "json");
    const olderName = "CDI_panel_old.csv";
    const newerName = "CDI_panel_new.csv";
    await mkdir(csvDir, { recursive: true });

    try {
      for (const [name, value] of [
        [olderName, 10],
        [newerName, 90],
      ] as const) {
        await writeFile(
          path.join(csvDir, name),
          [
            "location_key,location_name,ano,image_id,valor_classe_1",
            `pb,Paraíba,2026,image-${value},${value}`,
          ].join("\n"),
          "utf8",
        );
      }
      await writeTestDriveSnapshot(csvDir, [
        { localName: olderName, modifiedTime: "2026-06-01T10:00:00.000Z" },
        { localName: newerName, modifiedTime: "2026-06-02T10:00:00.000Z" },
      ]);

      const result = await convertCsvDirectory(
        {
          csvDir,
          jsonDir,
          fileNamePattern: /\.csv$/iu,
          writeAggregates: false,
          writeRawPartitions: true,
          maxContentfulJsonBytes: 450000,
        },
        minimalPipelineConfig,
      );
      const payload = JSON.parse(
        await readFile(result.panelLayerFiles[0].outputPath, "utf8"),
      );

      expect(payload.years["2026"].values.pb).toEqual([90]);
      expect(payload.years["2026"].imageId).toBe("image-90");
      expect(result.skipped[0].collision.winnerInputPath).toContain(newerName);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("merges complementary default templates from multilevel and municipal sources", async () => {
    const rootDir = path.join("/tmp", `sedes-mixed-territory-${Date.now()}`);
    const csvDir = path.join(rootDir, "csv");
    const jsonDir = path.join(rootDir, "json");
    const municipalName = "CDI_municipal.csv";
    const multilevelName = "CDI_multilevel.csv";
    const configWithoutTemplates = {
      ...minimalPipelineConfig,
      panelLayerProfiles: {
        CDI_Test: {
          ...minimalPipelineConfig.panelLayerProfiles.CDI_Test,
          templates: undefined,
        },
      },
    };
    await mkdir(csvDir, { recursive: true });

    try {
      await writeFile(
        path.join(csvDir, municipalName),
        [
          "CD_MUN,NM_MUN,SIGLA_UF,ano,data_img,perc_classe_0",
          "2507507,João Pessoa,PB,2026,2026-02-01,10",
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(csvDir, multilevelName),
        [
          "NIVEL_AGRUPAMENTO,NOME_LOCAL,CD_MUN,NM_MUN,SIGLA_UF,ano,data_img,perc_classe_0",
          "7_Municipio,João Pessoa,2507507,João Pessoa,PB,2026,2026-02-01,90",
        ].join("\n"),
        "utf8",
      );
      await writeTestDriveSnapshot(csvDir, [
        {
          localName: municipalName,
          modifiedTime: "2026-06-01T10:00:00.000Z",
        },
        {
          localName: multilevelName,
          modifiedTime: "2026-06-02T10:00:00.000Z",
        },
      ]);

      const result = await convertCsvDirectory(
        {
          csvDir,
          jsonDir,
          fileNamePattern: /\.csv$/iu,
          writeAggregates: false,
          writeRawPartitions: true,
          maxContentfulJsonBytes: 450000,
        },
        configWithoutTemplates,
      );
      const payload = JSON.parse(
        await readFile(result.partitionFiles[0].outputPath, "utf8"),
      );

      expect(payload.templates).toEqual({
        municipality: "municipality",
        state: "state",
      });
      expect(payload.years["2026-02"].values["2507507"]).toEqual([90]);
      expect(result.skipped).toEqual([
        expect.objectContaining({
          inputPath: expect.stringContaining(municipalName),
          ignored: true,
        }),
      ]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("fails colliding local CSVs without Drive metadata", async () => {
    const rootDir = path.join("/tmp", `sedes-missing-metadata-${Date.now()}`);
    const csvDir = path.join(rootDir, "csv");
    const jsonDir = path.join(rootDir, "json");
    await mkdir(csvDir, { recursive: true });

    try {
      for (const [name, value] of [
        ["CDI_first.csv", 10],
        ["CDI_second.csv", 20],
      ] as const) {
        await writeFile(
          path.join(csvDir, name),
          [
            "CD_MUN,NM_MUN,SIGLA_UF,ano,data_img,perc_classe_0",
            `2507507,João Pessoa,PB,2026,2026-02-01,${value}`,
          ].join("\n"),
          "utf8",
        );
      }

      await expect(
        convertCsvDirectory(
          {
            csvDir,
            jsonDir,
            fileNamePattern: /\.csv$/iu,
            writeAggregates: false,
            writeRawPartitions: true,
            maxContentfulJsonBytes: 450000,
          },
          minimalPipelineConfig,
        ),
      ).rejects.toThrow("não possui modifiedTime do Google Drive");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("fails divergent collisions with equal Drive modifiedTime", async () => {
    const rootDir = path.join("/tmp", `sedes-equal-metadata-${Date.now()}`);
    const csvDir = path.join(rootDir, "csv");
    const jsonDir = path.join(rootDir, "json");
    const names = ["CDI_first.csv", "CDI_second.csv"];
    await mkdir(csvDir, { recursive: true });

    try {
      for (const [index, name] of names.entries()) {
        await writeFile(
          path.join(csvDir, name),
          [
            "CD_MUN,NM_MUN,SIGLA_UF,ano,data_img,perc_classe_0",
            `2507507,João Pessoa,PB,2026,2026-02-01,${index + 1}`,
          ].join("\n"),
          "utf8",
        );
      }
      await writeTestDriveSnapshot(
        csvDir,
        names.map((localName) => ({
          localName,
          modifiedTime: "2026-06-01T10:00:00.000Z",
        })),
      );

      await expect(
        convertCsvDirectory(
          {
            csvDir,
            jsonDir,
            fileNamePattern: /\.csv$/iu,
            writeAggregates: false,
            writeRawPartitions: true,
            maxContentfulJsonBytes: 450000,
          },
          minimalPipelineConfig,
        ),
      ).rejects.toThrow("possuem o mesmo modifiedTime");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("converts only files registered in the current Drive snapshot", async () => {
    const rootDir = path.join("/tmp", `sedes-snapshot-scope-${Date.now()}`);
    const csvDir = path.join(rootDir, "csv");
    const jsonDir = path.join(rootDir, "json");
    const currentName = "CDI_current.csv";
    const staleName = "CDI_stale.csv";
    await mkdir(csvDir, { recursive: true });

    try {
      for (const name of [currentName, staleName]) {
        await writeFile(
          path.join(csvDir, name),
          [
            "CD_MUN,NM_MUN,SIGLA_UF,ano,data_img,perc_classe_0",
            "2507507,João Pessoa,PB,2026,2026-02-01,10",
          ].join("\n"),
          "utf8",
        );
      }
      await writeTestDriveSnapshot(csvDir, [
        {
          localName: currentName,
          modifiedTime: "2026-06-01T10:00:00.000Z",
        },
      ]);

      const result = await convertCsvDirectory(
        {
          csvDir,
          jsonDir,
          fileNamePattern: /\.csv$/iu,
          writeAggregates: false,
          writeRawPartitions: true,
          maxContentfulJsonBytes: 450000,
        },
        minimalPipelineConfig,
      );

      expect(result.conversions[0].inputPath).toContain(currentName);
      expect(result.conversions[0].inputPath).not.toContain(staleName);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects Drive files that would overwrite the same local CSV", () => {
    expect(() =>
      assertUniqueDriveLocalNames([
        {
          id: "sheet",
          name: "forecast",
          mimeType: "application/vnd.google-apps.spreadsheet",
        },
        { id: "csv", name: "forecast.csv", mimeType: "text/csv" },
      ]),
    ).toThrow("seriam gravados como forecast.csv");
  });

  it("writes compressed annual partitions and blocks ambiguous route keys", async () => {
    const partitionDir = path.join("/tmp", `sedes-partitions-${Date.now()}`);
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
