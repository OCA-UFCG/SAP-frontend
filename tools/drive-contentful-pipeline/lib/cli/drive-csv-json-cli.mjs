import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadPipelineConfig } from "../config/pipeline-config.mjs";
import { convertCsvDirectory } from "../conversion/output-files.mjs";
import {
  buildConversionReport,
  buildMunicipalAnalysisManifest,
  buildPanelLayerImageDataManifest,
  buildPipelineValidation,
} from "../conversion/manifests.mjs";
import { downloadCsvFiles } from "../drive/drive-client.mjs";
import { resolveWorkspacePath } from "../shared/paths.mjs";

function extractDriveFolderId(value) {
  const match = value.match(/\/folders\/([^/?#]+)/);

  if (!match?.[1]) {
    throw new Error(`URL de pasta do Drive inválida: ${value}`);
  }

  return match[1];
}

export function parseDriveCsvJsonArgs(argv, pipelineConfig) {
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
    else if (argument === "--file-name-pattern")
      options.fileNamePattern = new RegExp(nextValue(), "iu");
    else if (argument === "--skip-download") options.skipDownload = true;
    else if (argument === "--write-aggregates") options.writeAggregates = true;
    else if (argument === "--write-raw-partitions")
      options.writeRawPartitions = true;
    else if (argument === "--max-contentful-json-bytes")
      options.maxContentfulJsonBytes = Number(nextValue());
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

  return options;
}

function printHelp(pipelineConfig) {
  console.log(`Uso:
  node tools/drive-contentful-pipeline/drive-csv-to-json.mjs [opções]

Opções:
  --folder-id <id>              ID da pasta do Google Drive.
  --folder-url <url>            URL da pasta do Google Drive.
  --csv-dir <path>              Pasta destino dos CSVs baixados.
  --json-dir <path>             Pasta destino dos JSONs convertidos.
  --skip-download               Converte os CSVs já existentes em --csv-dir.
  --write-aggregates            Também escreve JSONs agregados grandes por panelLayerId.
  --write-raw-partitions        Escreve partições sem gzip/base64 para depuração local.
  --max-contentful-json-bytes <n>
                                Limite por JSON gerado. Padrão: ${pipelineConfig.limits.maxContentfulJsonBytes}.
  --file-name-pattern <regex>   Filtra nomes de arquivos do Drive. Padrão: ${pipelineConfig.defaults.fileNamePattern}
  --access-token <token>        OAuth token do Google Drive.
  --api-key <key>               API key para arquivos/pastas públicos.
`);
}

async function writeJsonFile(jsonDir, fileName, value) {
  await writeFile(
    path.join(resolveWorkspacePath(jsonDir), fileName),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

export async function runDriveCsvJsonCli(argv = process.argv.slice(2)) {
  const pipelineConfig = await loadPipelineConfig();
  const options = parseDriveCsvJsonArgs(argv, pipelineConfig);

  if (options.help) {
    printHelp(pipelineConfig);
    return;
  }

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
    {
      municipalAnalysisManifest,
      panelLayerImageDataManifest,
    },
  );

  await mkdir(resolveWorkspacePath(options.jsonDir), { recursive: true });
  await writeJsonFile(
    options.jsonDir,
    "municipal-analysis-manifest.json",
    municipalAnalysisManifest,
  );
  await writeJsonFile(
    options.jsonDir,
    "panel-layer-imageData-manifest.json",
    panelLayerImageDataManifest,
  );
  await writeJsonFile(options.jsonDir, "conversion-report.json", report);
  console.log(JSON.stringify(report, null, 2));

  if (!validation.ok) {
    throw new Error(
      `Validação da pipeline falhou: ${JSON.stringify(validation, null, 2)}`,
    );
  }
}

export function runIfMain(importMetaUrl) {
  if (
    process.argv[1] &&
    importMetaUrl === pathToFileURL(process.argv[1]).href
  ) {
    runDriveCsvJsonCli().catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
  }
}
