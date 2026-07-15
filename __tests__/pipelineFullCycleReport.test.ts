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
