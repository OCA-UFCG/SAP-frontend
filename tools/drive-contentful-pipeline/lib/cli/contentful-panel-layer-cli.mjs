import { pathToFileURL } from "node:url";
import {
  CONTENTFUL_WRITE_DELAY_MS,
  getDefaultLocale,
  sleep,
} from "../contentful/client.mjs";
import { getContentfulConfig, loadDotEnv } from "../contentful/env.mjs";
import {
  resolveImageDataEntries,
  syncPanelLayerImageData,
} from "../contentful/panel-layer-sync.mjs";

const DEFAULT_JSON_DIR = "data/contentful-pipeline/json";

export function parsePanelLayerArgs(argv) {
  const options = {
    panelLayerId: "",
    jsonDir: DEFAULT_JSON_DIR,
    imageDataPath: "",
    publish: false,
    dryRun: false,
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
    else if (argument === "--all-panel-layers") options.allPanelLayers = true;
    else if (argument === "--help" || argument === "-h")
      return { ...options, help: true };
    else throw new Error(`Argumento desconhecido: ${argument}`);
  }

  if (
    options.allPanelLayers &&
    (options.panelLayerId || options.imageDataPath)
  ) {
    throw new Error(
      "--all-panel-layers não deve ser usado junto com --panel-layer-id ou --image-data-path.",
    );
  }

  if (!options.allPanelLayers && !options.panelLayerId) {
    throw new Error("Informe --panel-layer-id ou use --all-panel-layers.");
  }

  return options;
}

function printHelp() {
  console.log(`Uso:
  node tools/drive-contentful-pipeline/contentful-update-panel-layer-image-data.mjs [opções]

Opções:
  --panel-layer-id <id>       id do panelLayer a atualizar.
  --json-dir <path>           Pasta com panel-layer-imageData-manifest.json.
  --image-data-path <path>    Caminho direto do imageData JSON.
  --all-panel-layers          Sincroniza todos os panelLayerId do manifesto.
  --dry-run                   Localiza entry e valida payload sem atualizar.
  --publish                   Publica a entry depois de atualizar.
`);
}

function printMissingManagementToken(options, locale, localeCheck, config) {
  console.log(
    JSON.stringify(
      {
        panelLayerId: options.panelLayerId || null,
        allPanelLayers: options.allPanelLayers,
        locale,
        managementTokenCheck: {
          ok: false,
          error:
            localeCheck.warning ??
            "CONTENTFUL_MANAGEMENT_TOKEN ausente; sync de panelLayer não executado.",
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

export async function runContentfulPanelLayerCli(argv = process.argv.slice(2)) {
  await loadDotEnv();
  const options = parsePanelLayerArgs(argv);
  if (options.help) {
    printHelp();
    return;
  }

  const config = getContentfulConfig();
  const localeCheck = await getDefaultLocale(config, !options.dryRun);
  const locale = localeCheck.locale;

  if (localeCheck.warning || !config.managementToken) {
    printMissingManagementToken(options, locale, localeCheck, config);
    return;
  }

  const entries = await resolveImageDataEntries(options);
  const results = [];

  for (const entry of entries) {
    results.push(await syncPanelLayerImageData(config, options, locale, entry));
    await sleep(CONTENTFUL_WRITE_DELAY_MS);
  }

  console.log(
    JSON.stringify(
      {
        allPanelLayers: options.allPanelLayers,
        panelLayerCount: results.length,
        locale,
        dryRun: options.dryRun,
        publish: options.publish,
        writeDelayMs: CONTENTFUL_WRITE_DELAY_MS,
        results,
      },
      null,
      2,
    ),
  );
}

export function runIfMain(importMetaUrl) {
  if (
    process.argv[1] &&
    importMetaUrl === pathToFileURL(process.argv[1]).href
  ) {
    runContentfulPanelLayerCli().catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
  }
}
