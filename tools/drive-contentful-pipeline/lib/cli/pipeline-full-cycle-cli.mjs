import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadPipelineConfig } from "../config/pipeline-config.mjs";
import { getDefaultLocale, sleep, CONTENTFUL_WRITE_DELAY_MS } from "../contentful/client.mjs";
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
import { syncMunicipalReportSeries } from "../contentful/municipal-report-series-sync.mjs";
import { convertCsvDirectory } from "../conversion/output-files.mjs";
import { buildMunicipalAvailabilityIndex } from "../conversion/availability-index.mjs";
import {
  buildConversionReport,
  buildMunicipalAnalysisManifest,
  buildPanelLayerImageDataManifest,
  buildMunicipalReportSeriesManifest,
  buildPipelineValidation,
} from "../conversion/manifests.mjs";
import { downloadCsvFiles } from "../drive/drive-client.mjs";
import { readJson } from "../io/json.mjs";
import {
  buildFullCycleReport,
  writeFullCycleReports,
} from "../reporting/full-cycle-report.mjs";
import {
  assertContentfulDryRunOk,
  formatContentfulMunicipalSummary,
  formatContentfulPanelLayerSummary,
  formatConversionSummary,
} from "../reporting/pipeline-summary.mjs";
import { runRuntimeSmokeTests } from "../runtime/smoke-tests.mjs";
import { resolveWorkspacePath } from "../shared/paths.mjs";

function extractDriveFolderId(value) {
  const match = value.match(/\/folders\/([^/?#]+)/);

  if (!match?.[1]) {
    throw new Error(`URL de pasta do Drive inválida: ${value}`);
  }

  return match[1];
}

function parseFullCycleArgs(argv, pipelineConfig) {
  const options = {
    folderId:
      process.env.GOOGLE_DRIVE_FOLDER_ID || pipelineConfig.drive.folderId,
    csvDir: pipelineConfig.paths.csvDir,
    jsonDir: pipelineConfig.paths.jsonDir,
    accessToken: process.env.GOOGLE_DRIVE_ACCESS_TOKEN || "",
    apiKey: process.env.GOOGLE_DRIVE_API_KEY || "",
    skipDownload: false,
    fileNamePattern: pipelineConfig.fileNamePattern,
    writeAggregates: false,
    writeRawPartitions: false,
    maxContentfulJsonBytes: pipelineConfig.limits.maxContentfulJsonBytes,
    publish: false,
    runtimeBaseUrl: "",
    sessionCookie: "",
    sessionCookieEnv: "",
    smokeLimit: 5,
    requireRuntimeSmoke: false,
    activateReportSeries: false,
    reportPath: path.join(
      pipelineConfig.paths.jsonDir,
      "pipeline-full-cycle-report.json",
    ),
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

    if (argument === "--folder-id") options.folderId = nextValue();
    else if (argument === "--folder-url")
      options.folderId = extractDriveFolderId(nextValue());
    else if (argument === "--csv-dir") options.csvDir = nextValue();
    else if (argument === "--json-dir") options.jsonDir = nextValue();
    else if (argument === "--access-token") options.accessToken = nextValue();
    else if (argument === "--api-key") options.apiKey = nextValue();
    else if (argument === "--skip-download") options.skipDownload = true;
    else if (argument === "--write-aggregates") options.writeAggregates = true;
    else if (argument === "--write-raw-partitions")
      options.writeRawPartitions = true;
    else if (argument === "--max-contentful-json-bytes")
      options.maxContentfulJsonBytes = Number(nextValue());
    else if (argument === "--publish") options.publish = true;
    else if (argument === "--dry-run") options.publish = false;
    else if (argument === "--runtime-base-url")
      options.runtimeBaseUrl = nextValue();
    else if (argument === "--session-cookie")
      options.sessionCookie = nextValue();
    else if (argument === "--session-cookie-env")
      options.sessionCookieEnv = nextValue();
    else if (argument === "--smoke-limit")
      options.smokeLimit = Number(nextValue());
    else if (argument === "--require-runtime-smoke")
      options.requireRuntimeSmoke = true;
    else if (argument === "--activate-report-series")
      options.activateReportSeries = true;
    else if (argument === "--report-path") options.reportPath = nextValue();
    else if (argument === "--help" || argument === "-h")
      return { ...options, help: true };
    else throw new Error(`Argumento desconhecido: ${argument}`);
  }

  if (
    !Number.isFinite(options.maxContentfulJsonBytes) ||
    options.maxContentfulJsonBytes <= 0
  ) {
    throw new Error("--max-contentful-json-bytes deve ser um número positivo.");
  }

  if (!Number.isInteger(options.smokeLimit) || options.smokeLimit <= 0) {
    throw new Error("--smoke-limit deve ser um inteiro positivo.");
  }

  return options;
}

function printHelp(pipelineConfig) {
  console.log(`Uso:
  node tools/drive-contentful-pipeline/pipeline-full-cycle.mjs [opções]

Opções:
  --publish                    Escreve e publica no Contentful. Sem essa flag, roda dry-run.
  --dry-run                    Força modo dry-run.
  --folder-id <id>             ID da pasta do Google Drive.
  --folder-url <url>           URL da pasta do Google Drive.
  --csv-dir <path>             Pasta dos CSVs. Padrão: ${pipelineConfig.paths.csvDir}
  --json-dir <path>            Pasta dos JSONs. Padrão: ${pipelineConfig.paths.jsonDir}
  --skip-download              Usa CSVs locais e não baixa do Drive.
  --write-raw-partitions       Escreve partições sem gzip/base64 para depuração.
  --max-contentful-json-bytes <n>
                               Limite por JSON gerado.
  --runtime-base-url <url>     Base URL para smoke test da rota publicada.
  --session-cookie <cookie>    Cookie de sessão para rota protegida.
  --session-cookie-env <name>  Nome da variável de ambiente com o cookie.
  --smoke-limit <n>            Número máximo de rotas a testar. Padrão: 5.
  --require-runtime-smoke      Falha se smoke for pulado ou tiver falhas.
  --activate-report-series     Ativa reportSeriesConfig após publicar os shards.
  --report-path <path>         Caminho do relatório JSON. Também gera .md.
`);
}

async function writeJsonFile(jsonDir, fileName, value) {
  await writeFile(
    path.join(resolveWorkspacePath(jsonDir), fileName),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

async function runConversion(options, pipelineConfig) {
  const downloads = options.skipDownload ? [] : await downloadCsvFiles(options);
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
    downloads,
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
      `Validação da pipeline falhou: ${JSON.stringify(validation, null, 2)}`,
    );
  }

  return report;
}

async function runPanelLayerSync(config, options, locale) {
  const syncOptions = {
    jsonDir: options.jsonDir,
    dryRun: !options.publish,
    publish: options.publish,
    allPanelLayers: true,
  };
  const entries = await resolveImageDataEntries(syncOptions);
  const results = [];

  for (const entry of entries) {
    results.push(await syncPanelLayerImageData(config, syncOptions, locale, entry));
    if (options.publish) await sleep(CONTENTFUL_WRITE_DELAY_MS);
  }

  return {
    allPanelLayers: true,
    panelLayerCount: results.length,
    locale,
    dryRun: syncOptions.dryRun,
    publish: syncOptions.publish,
    writeDelayMs: CONTENTFUL_WRITE_DELAY_MS,
    results,
  };
}

async function runMunicipalAnalysisSync(config, options, locale) {
  const syncOptions = {
    jsonDir: options.jsonDir,
    dryRun: !options.publish,
    publish: options.publish,
    syncPartitions: true,
    allPanelLayers: true,
  };
  const panelLayerIds = await resolveAllPanelLayerIds(syncOptions);
  const results = [];

  for (const panelLayerId of panelLayerIds) {
    const result = await syncPartitionEntries(
      config,
      { ...syncOptions, panelLayerId },
      locale,
    );
    results.push(summarizePartitionSyncResult(result));
  }

  return {
    allPanelLayers: true,
    panelLayerCount: panelLayerIds.length,
    locale,
    dryRun: syncOptions.dryRun,
    publish: syncOptions.publish,
    writeDelayMs: CONTENTFUL_WRITE_DELAY_MS,
    results,
  };
}

function assertRuntimeSmokeOk(runtimeSmoke, options) {
  if (!options.requireRuntimeSmoke) return;

  if (runtimeSmoke.status !== "passed") {
    throw new Error(
      `Runtime smoke falhou ou foi pulado: ${JSON.stringify(runtimeSmoke, null, 2)}`,
    );
  }
}

export async function runPipelineFullCycleCli(argv = process.argv.slice(2)) {
  await loadDotEnv();
  const pipelineConfig = await loadPipelineConfig();
  const options = parseFullCycleArgs(argv, pipelineConfig);

  if (options.help) {
    printHelp(pipelineConfig);
    return;
  }

  const conversionReport = await runConversion(options, pipelineConfig);
  console.log(formatConversionSummary(conversionReport));

  const config = getContentfulConfig({ needsDeliveryToken: true });
  const localeCheck = await getDefaultLocale(config, true);
  const panelLayerResult = await runPanelLayerSync(
    config,
    options,
    localeCheck.locale,
  );
  const municipalResult = await runMunicipalAnalysisSync(
    config,
    options,
    localeCheck.locale,
  );
  const reportSeriesResult = await syncMunicipalReportSeries(
    config,
    {
      jsonDir: options.jsonDir,
      dryRun: !options.publish,
      publish: options.publish,
      activate: options.activateReportSeries,
    },
    localeCheck.locale,
  );

  console.log(`\n${formatContentfulPanelLayerSummary(panelLayerResult)}`);
  console.log(`\n${formatContentfulMunicipalSummary(municipalResult)}`);
  console.log(`\nmunicipalReportSeries: ${reportSeriesResult.actions.length} shards; ${reportSeriesResult.activations.length} ativações.`);

  if (!options.publish) {
    assertContentfulDryRunOk(panelLayerResult, municipalResult);
  }

  const runtimeSmoke = await runRuntimeSmokeTests(options);
  assertRuntimeSmokeOk(runtimeSmoke, options);

  const fullReport = buildFullCycleReport({
    options,
    conversionReport,
    panelLayerResult,
    municipalResult,
    reportSeriesResult,
    runtimeSmoke,
  });
  const reportPaths = await writeFullCycleReports(
    fullReport,
    options.reportPath,
  );

  console.log(
    JSON.stringify(
      {
        ok:
          conversionReport.validation.ok &&
          (!options.requireRuntimeSmoke || runtimeSmoke.status === "passed"),
        mode: fullReport.mode,
        reportPaths,
        runtimeSmoke: {
          status: runtimeSmoke.status,
          tested: runtimeSmoke.tested,
          passed: runtimeSmoke.passed,
          failed: runtimeSmoke.failed,
          reason: runtimeSmoke.reason,
        },
      },
      null,
      2,
    ),
  );
}

export async function readFullCycleReport(reportPath) {
  return readJson(reportPath);
}

export function runIfMain(importMetaUrl) {
  if (
    process.argv[1] &&
    importMetaUrl === pathToFileURL(process.argv[1]).href
  ) {
    runPipelineFullCycleCli().catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
  }
}
