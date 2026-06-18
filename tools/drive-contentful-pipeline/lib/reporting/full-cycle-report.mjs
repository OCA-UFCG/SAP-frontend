import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { summarizeConversionCoverage } from "./pipeline-summary.mjs";
import { resolveWorkspacePath } from "../shared/paths.mjs";

function countActions(results) {
  return results.reduce((counts, result) => {
    for (const [action, count] of Object.entries(result.actions ?? {})) {
      counts[action] = (counts[action] ?? 0) + count;
    }

    return counts;
  }, {});
}

function panelLayerChanges(panelLayerResult) {
  return (panelLayerResult?.results ?? []).map((result) => ({
    panelLayerId: result.panelLayerId,
    currentYears: result.current?.years ?? 0,
    newYears: result.replacement?.years ?? 0,
    currentBytes: result.current?.imageDataBytes ?? 0,
    newBytes: result.replacement?.imageDataBytes ?? 0,
    defaultYear: result.replacement?.defaultYear,
    updated: Boolean(result.updated),
  }));
}

function coverageGaps(conversionReport, municipalResult) {
  return {
    unmappedSourceFiles: conversionReport.unmappedSourceFiles,
    unmappedAggregatedFiles: conversionReport.unmappedAggregatedFiles,
    unmappedPartitionFiles: conversionReport.unmappedPartitionFiles,
    ignoredSkippedCsvs: conversionReport.validation?.ignoredSkippedCsvs ?? [],
    missingPanelLayerYears: (municipalResult?.results ?? []).flatMap(
      (result) =>
        result.missingPanelLayerYears > 0
          ? [
              {
                panelLayerId: result.panelLayerId,
                missingPanelLayerYears: result.missingPanelLayerYears,
              },
            ]
          : [],
    ),
    blockingValidationErrors: (municipalResult?.results ?? []).flatMap(
      (result) =>
        result.blockingValidationErrors > 0
          ? [
              {
                panelLayerId: result.panelLayerId,
                blockingValidationErrors: result.blockingValidationErrors,
              },
            ]
          : [],
    ),
  };
}

export function buildFullCycleReport({
  options,
  conversionReport,
  panelLayerResult,
  municipalResult,
  runtimeSmoke,
}) {
  const municipalActions = countActions(municipalResult?.results ?? []);

  return {
    generatedAt: new Date().toISOString(),
    mode: options.publish ? "publish" : "dry-run",
    inputs: {
      csvDir: options.csvDir,
      jsonDir: options.jsonDir,
      skipDownload: options.skipDownload,
      runtimeBaseUrl: options.runtimeBaseUrl || null,
      smokeLimit: options.smokeLimit,
    },
    conversion: {
      downloadedFiles: conversionReport.downloadedFiles,
      convertedFiles: conversionReport.convertedFiles,
      panelLayerFiles: conversionReport.panelLayerFiles,
      municipalAnalysisPartitions: conversionReport.partitionFiles,
      validation: conversionReport.validation,
      coverage: summarizeConversionCoverage(conversionReport),
    },
    contentful: {
      panelLayers: {
        dryRun: panelLayerResult.dryRun,
        publish: panelLayerResult.publish,
        count: panelLayerResult.panelLayerCount,
        changes: panelLayerChanges(panelLayerResult),
      },
      municipalAnalysis: {
        dryRun: municipalResult.dryRun,
        publish: municipalResult.publish,
        panelLayerCount: municipalResult.panelLayerCount,
        actionCounts: municipalActions,
        results: municipalResult.results,
      },
    },
    coverageGaps: coverageGaps(conversionReport, municipalResult),
    runtimeSmoke,
  };
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

export function formatFullCycleMarkdown(report) {
  const conversionRows = report.conversion.coverage.map((row) => [
    row.panelLayerId,
    row.partitions,
    row.years,
    `${row.outputMb} MB`,
  ]);
  const panelRows = report.contentful.panelLayers.changes.map((row) => [
    row.panelLayerId,
    row.currentYears,
    row.newYears,
    row.defaultYear ?? "-",
    row.updated ? "yes" : "no",
  ]);
  const municipalRows = report.contentful.municipalAnalysis.results.map(
    (row) => [
      row.panelLayerId,
      row.partitions,
      row.existingEntries,
      row.staleEntries,
      row.missingPanelLayerYears,
      row.blockingValidationErrors,
    ],
  );
  const smokeRows = (report.runtimeSmoke.results ?? []).map((row) => [
    row.panelLayerId,
    row.yearKey,
    row.status ?? "-",
    row.ok ? "ok" : "failed",
    row.error ?? "-",
  ]);

  return [
    "# Drive -> JSON -> Contentful -> Runtime",
    "",
    `Generated at: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    "",
    "## Conversion",
    "",
    `Downloaded files: ${report.conversion.downloadedFiles}`,
    `Converted files: ${report.conversion.convertedFiles}`,
    `PanelLayer files: ${report.conversion.panelLayerFiles}`,
    `MunicipalAnalysis partitions: ${report.conversion.municipalAnalysisPartitions}`,
    "",
    markdownTable(["panelLayerId", "partitions", "years", "output"], conversionRows),
    "",
    "## Contentful panelLayer",
    "",
    markdownTable(
      ["panelLayerId", "currentYears", "newYears", "defaultYear", "updated"],
      panelRows,
    ),
    "",
    "## Contentful municipalAnalysis",
    "",
    markdownTable(
      ["panelLayerId", "partitions", "existing", "stale", "missingYears", "errors"],
      municipalRows,
    ),
    "",
    "## Coverage gaps",
    "",
    `Unmapped source files: ${report.coverageGaps.unmappedSourceFiles}`,
    `Unmapped partitions: ${report.coverageGaps.unmappedPartitionFiles}`,
    `Missing panelLayer years: ${report.coverageGaps.missingPanelLayerYears.length}`,
    `Blocking validation errors: ${report.coverageGaps.blockingValidationErrors.length}`,
    "",
    "## Runtime smoke",
    "",
    `Status: ${report.runtimeSmoke.status}`,
    report.runtimeSmoke.reason ? `Reason: ${report.runtimeSmoke.reason}` : "",
    `Tested: ${report.runtimeSmoke.tested}`,
    `Passed: ${report.runtimeSmoke.passed}`,
    `Failed: ${report.runtimeSmoke.failed}`,
    "",
    smokeRows.length
      ? markdownTable(["panelLayerId", "year", "status", "result", "error"], smokeRows)
      : "",
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export async function writeFullCycleReports(report, reportBasePath) {
  const resolvedBasePath = resolveWorkspacePath(reportBasePath);
  const jsonPath = resolvedBasePath.endsWith(".json")
    ? resolvedBasePath
    : `${resolvedBasePath}.json`;
  const markdownPath = jsonPath.replace(/\.json$/u, ".md");

  await mkdir(path.dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, `${formatFullCycleMarkdown(report)}\n`, "utf8");

  return {
    jsonPath: path.relative(process.cwd(), jsonPath),
    markdownPath: path.relative(process.cwd(), markdownPath),
  };
}
