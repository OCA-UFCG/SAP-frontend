function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function getYearRange(yearKeys) {
  const years = uniqueSorted(yearKeys);

  if (years.length === 0) return "-";
  if (years.length === 1) return years[0];

  return `${years[0]}..${years[years.length - 1]}`;
}

function pad(value, size) {
  return String(value).padEnd(size, " ");
}

function toTable(headers, rows) {
  const widths = headers.map((header, index) =>
    Math.max(
      header.length,
      ...rows.map((row) => String(row[index] ?? "").length),
    ),
  );
  const lines = [
    headers.map((header, index) => pad(header, widths[index])).join("  "),
    widths.map((width) => "-".repeat(width)).join("  "),
    ...rows.map((row) =>
      row.map((cell, index) => pad(cell, widths[index])).join("  "),
    ),
  ];

  return lines.join("\n");
}

export function summarizeConversionCoverage(report) {
  const rows = Object.values(
    (report.partitionFilesDetails ?? []).reduce((lookup, partition) => {
      const panelLayerId = partition.panelLayerId ?? "unmapped";
      const current = lookup[panelLayerId] ?? {
        panelLayerId,
        partitions: 0,
        years: [],
        rawBytes: 0,
        outputBytes: 0,
      };

      current.partitions += 1;
      current.years.push(...(partition.yearKeys ?? []));
      current.rawBytes += partition.rawBytes ?? 0;
      current.outputBytes += partition.outputBytes ?? 0;
      lookup[panelLayerId] = current;

      return lookup;
    }, {}),
  ).sort((left, right) => left.panelLayerId.localeCompare(right.panelLayerId));

  return rows.map((row) => ({
    panelLayerId: row.panelLayerId,
    partitions: row.partitions,
    years: getYearRange(row.years),
    outputMb: Number((row.outputBytes / 1024 / 1024).toFixed(2)),
  }));
}

export function formatConversionSummary(report) {
  const rows = summarizeConversionCoverage(report).map((row) => [
    row.panelLayerId,
    row.partitions,
    row.years,
    `${row.outputMb} MB`,
  ]);

  return [
    "Conversion summary",
    `ok: ${report.validation?.ok === true}`,
    `converted CSVs: ${report.convertedFiles}`,
    `panelLayer files: ${report.panelLayerFiles}`,
    `municipalAnalysis partitions: ${report.partitionFiles}`,
    `ignored skipped CSVs: ${report.validation?.ignoredSkippedCsvs?.length ?? 0}`,
    "",
    toTable(["panelLayerId", "partitions", "years", "output"], rows),
  ].join("\n");
}

export function formatContentfulMunicipalSummary(result) {
  const rows = result.results.map((row) => [
    row.panelLayerId,
    row.partitions,
    row.existingEntries,
    row.staleEntries,
    row.missingPanelLayerYears,
    row.blockingValidationErrors,
  ]);

  return [
    "Contentful municipalAnalysis dry-run",
    `layers: ${result.panelLayerCount}`,
    "",
    toTable(
      [
        "panelLayerId",
        "partitions",
        "existing",
        "stale",
        "missingYears",
        "errors",
      ],
      rows,
    ),
  ].join("\n");
}

export function formatContentfulPanelLayerSummary(result) {
  const rows = result.results.map((row) => [
    row.panelLayerId,
    row.current.years,
    row.replacement.years,
    row.replacement.defaultYear,
    row.replacement.imageDataBytes,
  ]);

  return [
    "Contentful panelLayer dry-run",
    `layers: ${result.panelLayerCount}`,
    "",
    toTable(
      ["panelLayerId", "currentYears", "newYears", "defaultYear", "bytes"],
      rows,
    ),
  ].join("\n");
}

export function assertContentfulDryRunOk(panelLayerResult, municipalResult) {
  const panelLayerFailures = panelLayerResult.results.filter(
    (result) => result.dryRun !== true,
  );
  const municipalFailures = municipalResult.results.filter(
    (result) => result.blockingValidationErrors > 0 || result.warnings > 0,
  );

  if (panelLayerFailures.length > 0 || municipalFailures.length > 0) {
    throw new Error(
      `Dry-run Contentful falhou: ${JSON.stringify(
        { panelLayerFailures, municipalFailures },
        null,
        2,
      )}`,
    );
  }
}
