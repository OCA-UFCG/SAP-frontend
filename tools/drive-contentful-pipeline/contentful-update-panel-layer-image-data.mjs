#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_JSON_DIR = "data/contentful-pipeline/json";
const DEFAULT_LOCALE = "en-US";
const PANEL_LAYER_CONTENT_TYPE_ID = "panelLayer";
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const CONTENTFUL_WRITE_DELAY_MS = 150;

function parseArgs(argv) {
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

      if (!value || value.startsWith("--")) {
        throw new Error(`Argumento sem valor: ${argument}`);
      }

      index += 1;
      return value;
    };

    if (argument === "--panel-layer-id") {
      options.panelLayerId = nextValue();
    } else if (argument === "--json-dir") {
      options.jsonDir = nextValue();
    } else if (argument === "--image-data-path") {
      options.imageDataPath = nextValue();
    } else if (argument === "--publish") {
      options.publish = true;
    } else if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--all-panel-layers") {
      options.allPanelLayers = true;
    } else if (argument === "--help" || argument === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Argumento desconhecido: ${argument}`);
    }
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

Ambiente:
  CONTENTFUL_MANAGEMENT_TOKEN
  CONTENTFUL_SPACE_ID ou NEXT_PUBLIC_CONTENTFUL_SPACE_ID
  CONTENTFUL_ENVIRONMENT ou NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT
`);
}

async function loadDotEnv(filePath = ".env") {
  let text = "";

  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }

    throw error;
  }

  for (const line of text.split(/\n/u)) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u,
    );

    if (!match || process.env[match[1]]) {
      continue;
    }

    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[match[1]] = value;
  }
}

function getEnv(primaryKey, fallbackKey) {
  return (
    process.env[primaryKey] ?? (fallbackKey ? process.env[fallbackKey] : "")
  );
}

function getRequiredEnv(primaryKey, fallbackKey) {
  const value = getEnv(primaryKey, fallbackKey);

  if (!value) {
    throw new Error(
      `Variável obrigatória ausente: ${primaryKey}${fallbackKey ? ` ou ${fallbackKey}` : ""}`,
    );
  }

  return value;
}

function getContentfulConfig() {
  return {
    spaceId: getRequiredEnv(
      "CONTENTFUL_SPACE_ID",
      "NEXT_PUBLIC_CONTENTFUL_SPACE_ID",
    ),
    environment:
      getEnv("CONTENTFUL_ENVIRONMENT", "NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT") ||
      "master",
    managementToken: getEnv("CONTENTFUL_MANAGEMENT_TOKEN"),
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readManifest(jsonDir) {
  return readJson(path.join(jsonDir, "panel-layer-imageData-manifest.json"));
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validatePanelLayerImageData(imageData, context = "") {
  const prefix = context ? `${context}: ` : "";
  const errors = [];

  if (!isRecord(imageData)) {
    return [`${prefix}imageData deve ser um objeto.`];
  }

  if (imageData.type !== "territorial-compact") {
    errors.push(`${prefix}type deve ser territorial-compact.`);
  }

  if (!isRecord(imageData.years) || Object.keys(imageData.years).length === 0) {
    errors.push(`${prefix}years deve ser um objeto não vazio.`);
  }

  if (
    typeof imageData.defaultYear !== "string" ||
    !imageData.years?.[imageData.defaultYear]
  ) {
    errors.push(`${prefix}defaultYear deve existir em years.`);
  }

  if (!Array.isArray(imageData.classes) || imageData.classes.length === 0) {
    errors.push(`${prefix}classes deve ser uma lista não vazia.`);
  }

  if (
    !isRecord(imageData.locations) ||
    Object.keys(imageData.locations).length === 0
  ) {
    errors.push(`${prefix}locations deve ser um objeto não vazio.`);
  }

  if (!isRecord(imageData.mapVisualization)) {
    errors.push(`${prefix}mapVisualization deve ser um objeto.`);
  }

  for (const [yearKey, yearEntry] of Object.entries(imageData.years ?? {})) {
    if (!isRecord(yearEntry)) {
      errors.push(`${prefix}years.${yearKey} deve ser um objeto.`);
      continue;
    }

    if (typeof yearEntry.imageId !== "string" || !yearEntry.imageId.trim()) {
      errors.push(`${prefix}years.${yearKey}.imageId ausente.`);
    }

    if (!isRecord(yearEntry.values)) {
      errors.push(`${prefix}years.${yearKey}.values deve ser um objeto.`);
    }
  }

  return errors;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function contentfulFetch(url, init, context, attempt = 1) {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < 5) {
      const retryAfter = Number(
        response.headers.get("x-contentful-ratelimit-reset"),
      );
      const delayMs = Number.isFinite(retryAfter)
        ? Math.max(retryAfter * 1000, 1000)
        : 1000 * attempt;

      await sleep(delayMs);

      return contentfulFetch(url, init, context, attempt + 1);
    }

    throw new Error(
      `${context} falhou com status ${response.status}: ${text.slice(0, 2000)}`,
    );
  }

  return text ? JSON.parse(text) : null;
}

async function getDefaultLocale(config, required = true) {
  if (!config.managementToken) {
    return {
      locale: DEFAULT_LOCALE,
      warning: null,
    };
  }

  try {
    const data = await contentfulFetch(
      `https://api.contentful.com/spaces/${config.spaceId}/environments/${config.environment}/locales`,
      {
        headers: {
          Authorization: `Bearer ${config.managementToken}`,
        },
      },
      "Consulta de locales do Contentful",
    );
    const defaultLocale = data.items?.find((locale) => locale.default);

    return {
      locale: defaultLocale?.code ?? DEFAULT_LOCALE,
      warning: null,
    };
  } catch (error) {
    if (required) {
      throw error;
    }

    return {
      locale: DEFAULT_LOCALE,
      warning: error instanceof Error ? error.message : String(error),
    };
  }
}

async function resolveImageDataEntries(options) {
  if (options.imageDataPath) {
    return [
      {
        panelLayerId: options.panelLayerId,
        imageDataPath: options.imageDataPath,
      },
    ];
  }

  const manifest = await readManifest(options.jsonDir);
  const entries = Array.isArray(manifest.panelLayers)
    ? manifest.panelLayers
    : [];

  if (options.allPanelLayers) {
    if (entries.length === 0) {
      throw new Error("Manifesto sem panelLayers para sincronizar.");
    }

    return entries;
  }

  const entry = entries.find(
    (item) => item.panelLayerId === options.panelLayerId,
  );

  if (!entry) {
    throw new Error(
      `Manifesto sem imageData para panelLayerId=${options.panelLayerId}.`,
    );
  }

  return [entry];
}

async function findPanelLayerEntry(config, panelLayerId, locale) {
  if (!config.managementToken) {
    throw new Error(
      "CONTENTFUL_MANAGEMENT_TOKEN ausente; busca de panelLayer não executada.",
    );
  }

  const url = new URL(
    `https://api.contentful.com/spaces/${config.spaceId}/environments/${config.environment}/entries`,
  );
  url.searchParams.set("content_type", PANEL_LAYER_CONTENT_TYPE_ID);
  url.searchParams.set(`fields.id.${locale}`, panelLayerId);
  url.searchParams.set("select", "sys,fields.id,fields.name,fields.imageData");
  url.searchParams.set("limit", "2");

  const data = await contentfulFetch(
    url,
    {
      headers: {
        Authorization: `Bearer ${config.managementToken}`,
      },
    },
    `Busca de panelLayer ${panelLayerId} via Management API`,
  );
  const matches = data.items ?? [];

  if (matches.length !== 1) {
    throw new Error(
      `Esperado 1 panelLayer com id=${panelLayerId}, encontrado ${matches.length}.`,
    );
  }

  return matches[0];
}

function getLocalizedField(entry, fieldId, locale) {
  return entry.fields?.[fieldId]?.[locale];
}

async function updatePanelLayerEntry(
  config,
  entry,
  imageData,
  locale,
  publish,
  operationContext,
) {
  const entryUrl = `https://api.contentful.com/spaces/${config.spaceId}/environments/${config.environment}/entries/${entry.sys.id}`;
  const currentEntry = await contentfulFetch(
    entryUrl,
    {
      headers: {
        Authorization: `Bearer ${config.managementToken}`,
      },
    },
    `Busca da entry ${entry.sys.id} (${operationContext}) via Management API`,
  );
  const operations = [
    currentEntry.fields?.imageData === undefined
      ? {
          op: "add",
          path: "/fields/imageData",
          value: { [locale]: imageData },
        }
      : {
          op:
            currentEntry.fields.imageData?.[locale] === undefined
              ? "add"
              : "replace",
          path: `/fields/imageData/${locale}`,
          value: imageData,
        },
  ];
  const updatedEntry = await contentfulFetch(
    entryUrl,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${config.managementToken}`,
        "Content-Type": "application/json-patch+json",
        "X-Contentful-Version": String(currentEntry.sys.version),
      },
      body: JSON.stringify(operations),
    },
    `Atualização do panelLayer ${operationContext} via Management API JSON Patch`,
  );

  if (!publish) {
    return updatedEntry;
  }

  return contentfulFetch(
    `${entryUrl}/published`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${config.managementToken}`,
        "X-Contentful-Version": String(updatedEntry.sys.version),
      },
    },
    `Publicação do panelLayer ${operationContext} via Management API`,
  );
}

async function syncPanelLayerImageData(config, options, locale, manifestEntry) {
  const imageData = await readJson(manifestEntry.imageDataPath);
  const validationErrors = validatePanelLayerImageData(
    imageData,
    manifestEntry.imageDataPath,
  );

  if (validationErrors.length > 0) {
    throw new Error(
      `Validação do imageData panelLayer falhou: ${JSON.stringify(
        validationErrors,
        null,
        2,
      )}`,
    );
  }

  const currentEntry = await findPanelLayerEntry(
    config,
    manifestEntry.panelLayerId,
    locale,
  );
  const currentImageData = getLocalizedField(currentEntry, "imageData", locale);
  const summary = {
    panelLayerId: manifestEntry.panelLayerId,
    entryId: currentEntry.sys.id,
    title:
      getLocalizedField(currentEntry, "name", locale) ||
      getLocalizedField(currentEntry, "title", locale),
    current: {
      publishedAt: currentEntry.sys.publishedAt,
      imageDataBytes: Buffer.byteLength(JSON.stringify(currentImageData ?? {})),
      years: Object.keys(currentImageData?.years ?? {}).length,
      locations: Object.keys(currentImageData?.locations ?? {}).length,
    },
    replacement: {
      imageDataPath: manifestEntry.imageDataPath,
      imageDataBytes: Buffer.byteLength(JSON.stringify(imageData)),
      years: Object.keys(imageData.years ?? {}).length,
      locations: Object.keys(imageData.locations ?? {}).length,
      defaultYear: imageData.defaultYear,
    },
    dryRun: options.dryRun,
    publish: options.publish,
  };

  if (options.dryRun) {
    return summary;
  }

  const updatedEntry = await updatePanelLayerEntry(
    config,
    currentEntry,
    imageData,
    locale,
    options.publish,
    manifestEntry.panelLayerId,
  );

  return {
    ...summary,
    updated: {
      entryId: updatedEntry.sys.id,
      version: updatedEntry.sys.version,
      publishedVersion: updatedEntry.sys.publishedVersion,
      publishedAt: updatedEntry.sys.publishedAt,
    },
  };
}

async function main() {
  await loadDotEnv();

  const options = parseArgs(process.argv.slice(2));
  const config = getContentfulConfig();
  const localeCheck = await getDefaultLocale(config, !options.dryRun);
  const locale = localeCheck.locale;

  if (localeCheck.warning || !config.managementToken) {
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

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
