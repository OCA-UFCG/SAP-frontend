import { pathToFileURL } from "node:url";
import { getDefaultLocale } from "../contentful/client.mjs";
import { getContentfulConfig, loadDotEnv } from "../contentful/env.mjs";
import {
  findMunicipalAnalysisEntry,
  resolveAllPanelLayerIds,
  resolveImageDataPath,
  syncPartitionEntries,
  summarizePartitionSyncResult,
} from "../contentful/municipal-analysis-sync.mjs";
import { patchEntryFields } from "../contentful/entries.mjs";
import { readJson } from "../io/json.mjs";
import { validateMunicipalAnalysisImageData } from "../validation/municipal-analysis.mjs";

const DEFAULT_JSON_DIR = "data/contentful-pipeline/json";
const DEFAULT_PANEL_LAYER_ID = "CDI_Test";

export function parseMunicipalAnalysisArgs(argv) {
  const options = {
    panelLayerId: DEFAULT_PANEL_LAYER_ID,
    jsonDir: DEFAULT_JSON_DIR,
    imageDataPath: "",
    publish: false,
    dryRun: false,
    syncPartitions: false,
    allPanelLayers: false,
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

    if (argument === "--panel-layer-id") options.panelLayerId = nextValue();
    else if (argument === "--json-dir") options.jsonDir = nextValue();
    else if (argument === "--image-data-path")
      options.imageDataPath = nextValue();
    else if (argument === "--publish") options.publish = true;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--sync-partitions") options.syncPartitions = true;
    else if (argument === "--all-panel-layers") options.allPanelLayers = true;
    else if (argument === "--help" || argument === "-h")
      return { ...options, help: true };
    else throw new Error(`Argumento desconhecido: ${argument}`);
  }

  return options;
}

function printHelp() {
  console.log(`Uso:
  node tools/drive-contentful-pipeline/contentful-update-municipal-analysis.mjs [opções]

Opções:
  --panel-layer-id <id>       panelLayerId do municipalAnalysis. Padrão: CDI_Test
  --json-dir <path>           Pasta com municipal-analysis-manifest.json.
  --image-data-path <path>    Caminho direto do imageData JSON.
  --sync-partitions           Sincroniza uma entry por partição do manifesto.
  --all-panel-layers          Com --sync-partitions, sincroniza todos os panelLayerId do manifesto.
  --dry-run                   Localiza entry e valida payload sem atualizar.
  --publish                   Publica a entry depois de atualizar.
`);
}

function printMissingManagementToken(options, locale, localeCheck, config) {
  console.log(
    JSON.stringify(
      {
        panelLayerId: options.panelLayerId,
        locale,
        managementTokenCheck: {
          ok: false,
          error:
            localeCheck.warning ??
            "CONTENTFUL_MANAGEMENT_TOKEN ausente; sync de partições não executado.",
        },
        dryRun: true,
        hasManagementToken: Boolean(config.managementToken),
        publish: options.publish,
      },
      null,
      2,
    ),
  );
}

async function runAllPartitionSync(config, options, locale) {
  const panelLayerIds = await resolveAllPanelLayerIds(options);
  const results = [];

  for (const panelLayerId of panelLayerIds) {
    const result = await syncPartitionEntries(
      config,
      { ...options, panelLayerId },
      locale,
    );
    results.push(summarizePartitionSyncResult(result));
  }

  console.log(
    JSON.stringify(
      {
        allPanelLayers: true,
        panelLayerCount: panelLayerIds.length,
        locale,
        dryRun: options.dryRun,
        publish: options.publish,
        writeDelayMs: 150,
        results,
      },
      null,
      2,
    ),
  );
}

async function runPartitionSync(config, options, locale, localeCheck) {
  if (localeCheck.warning || !config.managementToken) {
    printMissingManagementToken(options, locale, localeCheck, config);
    return;
  }

  if (options.allPanelLayers) {
    await runAllPartitionSync(config, options, locale);
    return;
  }

  console.log(
    JSON.stringify(
      await syncPartitionEntries(config, options, locale),
      null,
      2,
    ),
  );
}

async function runLegacyImageDataUpdate(config, options, locale, localeCheck) {
  const imageDataPath = await resolveImageDataPath(options);
  const imageData = await readJson(imageDataPath);
  const imageDataValidationErrors = validateMunicipalAnalysisImageData(
    imageData,
    imageDataPath,
  );

  if (imageDataValidationErrors.length > 0) {
    throw new Error(
      `Validação do imageData municipalAnalysis falhou: ${JSON.stringify(imageDataValidationErrors, null, 2)}`,
    );
  }

  const currentEntry = await findMunicipalAnalysisEntry(
    config,
    options.panelLayerId,
  );
  const summary = buildLegacySummary(
    options,
    locale,
    localeCheck,
    config,
    currentEntry,
    imageDataPath,
    imageData,
  );

  if (options.dryRun || !config.managementToken) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const updatedEntry = await patchEntryFields(
    config,
    currentEntry,
    { imageData },
    locale,
    options.publish,
    currentEntry.sys.id,
  );
  console.log(
    JSON.stringify(
      {
        ...summary,
        dryRun: false,
        updated: {
          entryId: updatedEntry.sys.id,
          version: updatedEntry.sys.version,
          publishedVersion: updatedEntry.sys.publishedVersion,
          publishedAt: updatedEntry.sys.publishedAt,
        },
      },
      null,
      2,
    ),
  );
}

function buildLegacySummary(
  options,
  locale,
  localeCheck,
  config,
  currentEntry,
  imageDataPath,
  imageData,
) {
  return {
    panelLayerId: options.panelLayerId,
    entryId: currentEntry.sys.id,
    title: currentEntry.title,
    current: {
      publishedAt: currentEntry.sys.publishedAt,
      imageDataBytes: Buffer.byteLength(
        JSON.stringify(currentEntry.imageData ?? {}),
      ),
      years: Object.keys(currentEntry.imageData?.years ?? {}).length,
      locations: Object.keys(currentEntry.imageData?.locations ?? {}).length,
    },
    replacement: {
      imageDataPath,
      imageDataBytes: Buffer.byteLength(JSON.stringify(imageData)),
      years: Object.keys(imageData.years ?? {}).length,
      locations: Object.keys(imageData.locations ?? {}).length,
    },
    locale,
    managementTokenCheck: localeCheck.warning
      ? { ok: false, error: localeCheck.warning }
      : { ok: Boolean(config.managementToken) },
    dryRun: options.dryRun || !config.managementToken,
    hasManagementToken: Boolean(config.managementToken),
    publish: options.publish,
  };
}

export async function runContentfulMunicipalAnalysisCli(
  argv = process.argv.slice(2),
) {
  await loadDotEnv();
  const options = parseMunicipalAnalysisArgs(argv);
  if (options.help) {
    printHelp();
    return;
  }

  const config = getContentfulConfig({ needsDeliveryToken: true });
  const localeCheck = await getDefaultLocale(config, !options.dryRun);
  const locale = localeCheck.locale;

  if (options.syncPartitions) {
    await runPartitionSync(config, options, locale, localeCheck);
    return;
  }

  await runLegacyImageDataUpdate(config, options, locale, localeCheck);
}

export function runIfMain(importMetaUrl) {
  if (
    process.argv[1] &&
    importMetaUrl === pathToFileURL(process.argv[1]).href
  ) {
    runContentfulMunicipalAnalysisCli().catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
  }
}
