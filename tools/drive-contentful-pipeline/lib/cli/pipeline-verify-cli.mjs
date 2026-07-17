import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadPipelineConfig } from "../config/pipeline-config.mjs";
import { convertCsvDirectory } from "../conversion/output-files.mjs";
import { buildMunicipalAvailabilityIndex } from "../conversion/availability-index.mjs";
import {
  buildConversionReport,
  buildMunicipalAnalysisManifest,
  buildPanelLayerImageDataManifest,
  buildMunicipalReportSeriesManifest,
  buildPipelineValidation,
} from "../conversion/manifests.mjs";
import { getDefaultLocale } from "../contentful/client.mjs";
import { getContentfulConfig, loadDotEnv } from "../contentful/env.mjs";
import {
  resolveImageDataEntries,
  syncPanelLayerImageData,
} from "../contentful/panel-layer-sync.mjs";
import {
  resolveAllPanelLayerIds,
  summarizePartitionSyncResult,
  syncPartitionEntries,
} from "../contentful/municipal-analysis-sync.mjs";
import {
  assertContentfulDryRunOk,
  formatContentfulMunicipalSummary,
  formatContentfulPanelLayerSummary,
  formatConversionSummary,
} from "../reporting/pipeline-summary.mjs";
import { resolveWorkspacePath } from "../shared/paths.mjs";
import { readJson } from "../io/json.mjs";
import { syncMunicipalReportSeries } from "../contentful/municipal-report-series-sync.mjs";

function parseVerifyArgs(argv, pipelineConfig) {
  const options = {
    csvDir: pipelineConfig.paths.csvDir,
    jsonDir: pipelineConfig.paths.jsonDir,
    skipDownload: true,
    localOnly: false,
    maxContentfulJsonBytes: pipelineConfig.limits.maxContentfulJsonBytes,
    fileNamePattern: pipelineConfig.fileNamePattern,
    writeAggregates: false,
    writeRawPartitions: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--"))
        throw new Error(`Argumento sem valor: ${argument}`);
      index += 1;
      return value;
    };

    if (argument === "--csv-dir") options.csvDir = nextValue();
    else if (argument === "--json-dir") options.jsonDir = nextValue();
    else if (argument === "--local-only") options.localOnly = true;
    else if (argument === "--write-raw-partitions")
      options.writeRawPartitions = true;
    else if (argument === "--max-contentful-json-bytes")
      options.maxContentfulJsonBytes = Number(nextValue());
    else if (argument === "--help" || argument === "-h")
      return { ...options, help: true };
    else throw new Error(`Argumento desconhecido: ${argument}`);
  }

  return options;
}

function printHelp() {
  console.log(`Uso:
  node tools/drive-contentful-pipeline/pipeline-verify.mjs [opções]

Opções:
  --csv-dir <path>              Pasta local dos CSVs.
  --json-dir <path>             Pasta destino dos JSONs convertidos.
  --local-only                  Valida conversão/manifestos sem acessar Contentful.
  --write-raw-partitions        Escreve partições sem gzip/base64 para depuração local.
  --max-contentful-json-bytes <n>
                                Limite por JSON gerado.
`);
}

async function writeJsonFile(jsonDir, fileName, value) {
  await writeFile(
    path.join(resolveWorkspacePath(jsonDir), fileName),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

async function runLocalConversion(options, pipelineConfig) {
  const conversionResult = await convertCsvDirectory(options, pipelineConfig);
  const municipalAnalysisManifest = buildMunicipalAnalysisManifest(
    conversionResult.aggregatedFiles,
    conversionResult.partitionFiles,
    pipelineConfig,
  );
  const panelLayerImageDataManifest = buildPanelLayerImageDataManifest(
    conversionResult.panelLayerFiles,
  );
  const municipalReportSeriesManifest = buildMunicipalReportSeriesManifest(
    conversionResult.reportSeries,
  );
  const municipalAvailabilityIndex = buildMunicipalAvailabilityIndex(
    conversionResult.availabilityEntries,
    conversionResult.panelLayerFiles,
  );
  const validation = buildPipelineValidation(
    conversionResult.conversions,
    conversionResult.partitionFiles,
    conversionResult.skipped,
    options,
  );
  const report = buildConversionReport(
    conversionResult,
    [],
    validation,
    options,
    { municipalAnalysisManifest, panelLayerImageDataManifest, municipalReportSeriesManifest },
  );

  await mkdir(resolveWorkspacePath(options.jsonDir), { recursive: true });
  await writeJsonFile(
    options.jsonDir,
    "municipal-analysis-manifest.json",
    municipalAnalysisManifest,
  );
  await writeJsonFile(
    options.jsonDir,
    "municipal-report-series-manifest.json",
    municipalReportSeriesManifest,
  );
  await writeJsonFile(
    options.jsonDir,
    "panel-layer-imageData-manifest.json",
    panelLayerImageDataManifest,
  );
  await writeJsonFile(options.jsonDir, "conversion-report.json", report);
  await writeJsonFile(
    "src/data",
    "municipalAvailabilityIndex.json",
    municipalAvailabilityIndex,
  );

  if (!validation.ok) {
    throw new Error(
      `Validação local falhou: ${JSON.stringify(validation, null, 2)}`,
    );
  }

  return report;
}

async function runPanelLayerDryRun(config, jsonDir, locale) {
  const options = {
    jsonDir,
    dryRun: true,
    publish: false,
    allPanelLayers: true,
  };
  const entries = await resolveImageDataEntries(options);
  const results = [];

  for (const entry of entries) {
    results.push(await syncPanelLayerImageData(config, options, locale, entry));
  }

  return {
    allPanelLayers: true,
    panelLayerCount: results.length,
    locale,
    dryRun: true,
    publish: false,
    results,
  };
}

async function getExpectedPanelLayerYearKeys(jsonDir) {
  const manifest = await readJson(
    path.join(
      resolveWorkspacePath(jsonDir),
      "panel-layer-imageData-manifest.json",
    ),
  );

  return Object.fromEntries(
    (manifest.panelLayers ?? []).map((entry) => [
      entry.panelLayerId,
      entry.yearKeys ?? [],
    ]),
  );
}

async function runMunicipalAnalysisDryRun(config, jsonDir, locale) {
  const baseOptions = {
    jsonDir,
    dryRun: true,
    publish: false,
    syncPartitions: true,
    allPanelLayers: true,
    expectedPanelLayerYearKeys: await getExpectedPanelLayerYearKeys(jsonDir),
  };
  const panelLayerIds = await resolveAllPanelLayerIds(baseOptions);
  const results = [];

  for (const panelLayerId of panelLayerIds) {
    const result = await syncPartitionEntries(
      config,
      { ...baseOptions, panelLayerId },
      locale,
    );
    results.push(summarizePartitionSyncResult(result));
  }

  return {
    allPanelLayers: true,
    panelLayerCount: panelLayerIds.length,
    locale,
    dryRun: true,
    publish: false,
    results,
  };
}

export async function runPipelineVerifyCli(argv = process.argv.slice(2)) {
  const pipelineConfig = await loadPipelineConfig();
  const options = parseVerifyArgs(argv, pipelineConfig);

  if (options.help) {
    printHelp();
    return;
  }

  const conversionReport = await runLocalConversion(options, pipelineConfig);
  console.log(formatConversionSummary(conversionReport));

  if (options.localOnly) return;

  await loadDotEnv();
  const config = getContentfulConfig({ needsDeliveryToken: true });
  const localeCheck = await getDefaultLocale(config, true);
  const panelLayerResult = await runPanelLayerDryRun(
    config,
    options.jsonDir,
    localeCheck.locale,
  );
  const municipalResult = await runMunicipalAnalysisDryRun(
    config,
    options.jsonDir,
    localeCheck.locale,
  );
  const reportSeriesResult = await syncMunicipalReportSeries(
    config,
    { jsonDir: options.jsonDir, dryRun: true, publish: false, activate: true },
    localeCheck.locale,
  );

  console.log(`\n${formatContentfulPanelLayerSummary(panelLayerResult)}`);
  console.log(`\n${formatContentfulMunicipalSummary(municipalResult)}`);
  console.log(`\nmunicipalReportSeries: ${reportSeriesResult.actions.length} shards validados.`);
  assertContentfulDryRunOk(panelLayerResult, municipalResult);
}

export function runIfMain(importMetaUrl) {
  if (
    process.argv[1] &&
    importMetaUrl === pathToFileURL(process.argv[1]).href
  ) {
    runPipelineVerifyCli().catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
  }
}
