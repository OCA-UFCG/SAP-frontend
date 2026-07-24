import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildFullCycleReport,
  formatFullCycleMarkdown,
  writeFullCycleReports,
} from "../tools/drive-contentful-pipeline/lib/reporting/full-cycle-report.mjs";
import { runRuntimeSmokeTests } from "../tools/drive-contentful-pipeline/lib/runtime/smoke-tests.mjs";
import { getExpectedPanelLayerYearKeys } from "../tools/drive-contentful-pipeline/lib/contentful/panel-layer-sync.mjs";
import { validatePartitionsAgainstPanelLayer } from "../tools/drive-contentful-pipeline/lib/contentful/municipal-analysis-sync.mjs";

function buildReportInput() {
  return {
    options: {
      publish: false,
      csvDir: "csv",
      jsonDir: "json",
      skipDownload: true,
      runtimeBaseUrl: "https://runtime.example",
      smokeLimit: 1,
    },
    conversionReport: {
      downloadedFiles: 0,
      convertedFiles: 2,
      panelLayerFiles: 1,
      partitionFiles: 1,
      unmappedSourceFiles: 1,
      unmappedAggregatedFiles: 0,
      unmappedPartitionFiles: 0,
      validation: {
        ok: true,
        ignoredSkippedCsvs: [],
      },
      partitionFilesDetails: [
        {
          panelLayerId: "CDI_Test",
          yearKeys: ["2026"],
          outputBytes: 1024,
        },
      ],
    },
    panelLayerResult: {
      dryRun: true,
      publish: false,
      panelLayerCount: 1,
      results: [
        {
          panelLayerId: "CDI_Test",
          current: { years: 1, imageDataBytes: 100 },
          replacement: {
            years: 2,
            imageDataBytes: 200,
            defaultYear: "2026",
          },
        },
      ],
    },
    municipalResult: {
      dryRun: true,
      publish: false,
      panelLayerCount: 1,
      results: [
        {
          panelLayerId: "CDI_Test",
          partitions: 1,
          existingEntries: 0,
          staleEntries: 0,
          missingPanelLayerYears: 0,
          blockingValidationErrors: 0,
          actions: { create: 1 },
        },
      ],
    },
    runtimeSmoke: {
      status: "passed",
      tested: 1,
      passed: 1,
      failed: 0,
      results: [
        {
          panelLayerId: "CDI_Test",
          yearKey: "2026",
          status: 200,
          ok: true,
        },
      ],
    },
  };
}

describe("pipeline full-cycle report", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds and writes consumable JSON and Markdown reports", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sedes-full-cycle-"));
    const report = buildFullCycleReport(buildReportInput());

    expect(report.mode).toBe("dry-run");
    expect(report.contentful.municipalAnalysis.actionCounts).toEqual({
      create: 1,
    });
    expect(formatFullCycleMarkdown(report)).toContain(
      "Drive -> JSON -> Contentful -> Runtime",
    );

    const paths = await writeFullCycleReports(
      report,
      path.join(tempDir, "report.json"),
    );

    await expect(readFile(paths.jsonPath, "utf8")).resolves.toContain(
      '"mode": "dry-run"',
    );
    await expect(readFile(paths.markdownPath, "utf8")).resolves.toContain(
      "Contentful municipalAnalysis",
    );
  });

  it("reads proposed panelLayer years for chained municipal validation", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sedes-panel-years-"));
    await writeFile(
      path.join(tempDir, "panel-layer-imageData-manifest.json"),
      JSON.stringify({
        panelLayers: [
          {
            panelLayerId: "prev_anomalia_precipitacao",
            yearKeys: [
              "2026-05",
              "2026-06",
              "2026-07",
              "2026-08",
              "2026-09",
              "2026-10",
            ],
          },
          {
            panelLayerId: "anaseca",
            yearKeys: ["2026-04"],
          },
        ],
      }),
      "utf8",
    );

    await expect(getExpectedPanelLayerYearKeys(tempDir)).resolves.toEqual({
      prev_anomalia_precipitacao: [
        "2026-05",
        "2026-06",
        "2026-07",
        "2026-08",
        "2026-09",
        "2026-10",
      ],
      anaseca: ["2026-04"],
    });

    await expect(
      validatePartitionsAgainstPanelLayer(
        {},
        "prev_anomalia_precipitacao",
        [
          {
            partitionKey: "2026",
            imageDataPath: "forecast.json",
            yearKeys: [
              "2026-05",
              "2026-06",
              "2026-07",
              "2026-08",
              "2026-09",
              "2026-10",
            ],
          },
        ],
        (await getExpectedPanelLayerYearKeys(tempDir))
          .prev_anomalia_precipitacao,
      ),
    ).resolves.toMatchObject({
      missingPanelLayerYears: [],
    });
  });

  it("skips runtime smoke without runtime URL or session cookie", async () => {
    await expect(
      runRuntimeSmokeTests({ jsonDir: "unused", smokeLimit: 1 }),
    ).resolves.toMatchObject({
      status: "skipped",
      tested: 0,
    });
    await expect(
      runRuntimeSmokeTests({
        jsonDir: "unused",
        runtimeBaseUrl: "https://runtime.example",
        smokeLimit: 1,
      }),
    ).resolves.toMatchObject({
      status: "skipped",
      tested: 0,
    });
  });

  it("smoke-tests published municipal analysis routes with a session cookie", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sedes-smoke-"));
    await writeFile(
      path.join(tempDir, "municipal-analysis-manifest.json"),
      JSON.stringify({
        partitions: [
          {
            panelLayerId: "CDI_Test",
            partitionKey: "2026",
            imageDataPath: "partition.json",
            yearKeys: ["2026"],
          },
        ],
      }),
      "utf8",
    );
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ imageData: { years: {} } }), {
        status: 200,
        headers: { "cache-control": "private, max-age=600" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      runRuntimeSmokeTests({
        jsonDir: tempDir,
        runtimeBaseUrl: "https://runtime.example/",
        sessionCookie: "session=abc",
        smokeLimit: 1,
      }),
    ).resolves.toMatchObject({
      status: "passed",
      tested: 1,
      passed: 1,
      failed: 0,
      results: [
        {
          panelLayerId: "CDI_Test",
          yearKey: "2026",
          status: 200,
          ok: true,
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://runtime.example/api/municipal-analysis/CDI_Test?year=2026",
      { headers: { Cookie: "session=abc" } },
    );
  });
});
