#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_JSON_DIR = "data/contentful-pipeline/json";
const DEFAULT_PANEL_LAYER_ID = "CDI_Test";
const DEFAULT_LOCALE = "en-US";
const MUNICIPAL_ANALYSIS_CONTENT_TYPE_ID = "municipalAnalysis";

function parseArgs(argv) {
  const options = {
    panelLayerId: DEFAULT_PANEL_LAYER_ID,
    jsonDir: DEFAULT_JSON_DIR,
    imageDataPath: "",
    publish: false,
    dryRun: false,
    syncPartitions: false,
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
    } else if (argument === "--sync-partitions") {
      options.syncPartitions = true;
    } else if (argument === "--help" || argument === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Argumento desconhecido: ${argument}`);
    }
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
  --sync-partitions           Sincroniza uma entry por partição anual do manifesto.
  --dry-run                   Localiza entry e valida payload sem atualizar.
  --publish                   Publica a entry depois de atualizar.

Ambiente:
  NEXT_PUBLIC_CONTENTFUL_SPACE_ID ou CONTENTFUL_SPACE_ID
  CONTENTFUL_ENVIRONMENT ou NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT
  NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN ou CONTENTFUL_ACCESS_TOKEN
  CONTENTFUL_MANAGEMENT_TOKEN para atualizar via Management API
  NEXT_PUBLIC_CONTENTFUL_MANAGEMENT_TOKEN tambem e aceito como fallback local
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
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);

    if (!match) {
      continue;
    }

    const key = match[1];

    if (process.env[key]) {
      continue;
    }

    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function getEnv(primaryKey, fallbackKey) {
  return process.env[primaryKey] ?? (fallbackKey ? process.env[fallbackKey] : "");
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
  const usePreview =
    getEnv("CONTENTFUL_PREVIEW", "NEXT_PUBLIC_CONTENTFUL_PREVIEW") === "true";

  return {
    spaceId: getRequiredEnv("CONTENTFUL_SPACE_ID", "NEXT_PUBLIC_CONTENTFUL_SPACE_ID"),
    environment: getEnv("CONTENTFUL_ENVIRONMENT", "NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT") || "master",
    deliveryToken: usePreview
      ? getRequiredEnv("CONTENTFUL_PREVIEW_TOKEN", "NEXT_PUBLIC_CONTENTFUL_PREVIEW_TOKEN")
      : getRequiredEnv("CONTENTFUL_ACCESS_TOKEN", "NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN"),
    managementToken: getEnv(
      "CONTENTFUL_MANAGEMENT_TOKEN",
      "NEXT_PUBLIC_CONTENTFUL_MANAGEMENT_TOKEN",
    ),
    usePreview,
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function resolveImageDataPath(options) {
  if (options.imageDataPath) {
    return options.imageDataPath;
  }

  const manifestPath = path.join(options.jsonDir, "municipal-analysis-manifest.json");
  const manifest = await readJson(manifestPath);
  const entry = manifest.mapped.find(
    (item) => item.panelLayerId === options.panelLayerId,
  );

  if (!entry) {
    throw new Error(
      `Manifesto sem JSON mapeado para panelLayerId=${options.panelLayerId}.`,
    );
  }

  return entry.imageDataPath;
}

async function resolvePartitionEntries(options) {
  const manifestPath = path.join(options.jsonDir, "municipal-analysis-manifest.json");
  const manifest = await readJson(manifestPath);
  const partitions = (manifest.partitions ?? [])
    .filter((item) => item.panelLayerId === options.panelLayerId)
    .sort((left, right) => left.calendarYear.localeCompare(right.calendarYear));

  if (partitions.length === 0) {
    throw new Error(
      `Manifesto sem partições para panelLayerId=${options.panelLayerId}.`,
    );
  }

  return partitions;
}

function buildPartitionTitle(panelLayerId, calendarYear) {
  return `Municipal Analysis ${panelLayerId} ${calendarYear}`;
}

async function contentfulFetch(url, init, context) {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `${context} falhou com status ${response.status}: ${text.slice(0, 2000)}`,
    );
  }

  return text ? JSON.parse(text) : null;
}

async function findMunicipalAnalysisEntry(config, panelLayerId) {
  const endpoint = `https://graphql.contentful.com/content/v1/spaces/${config.spaceId}/environments/${config.environment}`;
  const query = `
    query FindMunicipalAnalysis($preview: Boolean!) {
      municipalAnalysisCollection(limit: 100, preview: $preview) {
        items {
          sys {
            id
            publishedAt
          }
          title
          panelLayerId
          imageData
        }
      }
    }
  `;
  const data = await contentfulFetch(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.deliveryToken}`,
      },
      body: JSON.stringify({
        query,
        variables: { preview: config.usePreview },
      }),
    },
    "Consulta GraphQL do Contentful",
  );

  if (data.errors?.length) {
    throw new Error(JSON.stringify(data.errors, null, 2));
  }

  const matches = (data.data?.municipalAnalysisCollection?.items ?? []).filter(
    (item) => item?.panelLayerId === panelLayerId,
  );

  if (matches.length !== 1) {
    throw new Error(
      `Esperado 1 municipalAnalysis com panelLayerId=${panelLayerId}, encontrado ${matches.length}.`,
    );
  }

  return matches[0];
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

async function updateEntry(config, entryId, imageData, locale, publish) {
  if (!config.managementToken) {
    throw new Error("CONTENTFUL_MANAGEMENT_TOKEN ausente; atualização não executada.");
  }

  const entryUrl = `https://api.contentful.com/spaces/${config.spaceId}/environments/${config.environment}/entries/${entryId}`;
  const entry = await contentfulFetch(
    entryUrl,
    {
      headers: {
        Authorization: `Bearer ${config.managementToken}`,
      },
    },
    "Busca da entry via Management API",
  );
  const version = entry.sys.version;
  const updatedEntry = await contentfulFetch(
    entryUrl,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${config.managementToken}`,
        "Content-Type": "application/json-patch+json",
        "X-Contentful-Version": String(version),
      },
      body: JSON.stringify([
        {
          op: entry.fields.imageData?.[locale] === undefined ? "add" : "replace",
          path: `/fields/imageData/${locale}`,
          value: imageData,
        },
      ]),
    },
    "Atualização da entry via Management API JSON Patch",
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
    "Publicação da entry via Management API",
  );
}

async function listManagementEntriesByPanelLayerId(config, panelLayerId, locale) {
  if (!config.managementToken) {
    throw new Error("CONTENTFUL_MANAGEMENT_TOKEN ausente; listagem não executada.");
  }

  const url = new URL(
    `https://api.contentful.com/spaces/${config.spaceId}/environments/${config.environment}/entries`,
  );
  url.searchParams.set("content_type", MUNICIPAL_ANALYSIS_CONTENT_TYPE_ID);
  url.searchParams.set(`fields.panelLayerId.${locale}`, panelLayerId);
  url.searchParams.set("limit", "1000");

  const data = await contentfulFetch(
    url,
    {
      headers: {
        Authorization: `Bearer ${config.managementToken}`,
      },
    },
    "Listagem de entries via Management API",
  );

  return data.items ?? [];
}

function getLocalizedField(entry, fieldId, locale) {
  return entry.fields?.[fieldId]?.[locale];
}

async function patchEntryFields(config, entry, fields, locale, publish) {
  const entryUrl = `https://api.contentful.com/spaces/${config.spaceId}/environments/${config.environment}/entries/${entry.sys.id}`;
  const operations = Object.entries(fields).map(([fieldId, value]) => ({
    op: entry.fields?.[fieldId]?.[locale] === undefined ? "add" : "replace",
    path: `/fields/${fieldId}/${locale}`,
    value,
  }));
  const updatedEntry = await contentfulFetch(
    entryUrl,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${config.managementToken}`,
        "Content-Type": "application/json-patch+json",
        "X-Contentful-Version": String(entry.sys.version),
      },
      body: JSON.stringify(operations),
    },
    `Atualização da entry ${entry.sys.id} via Management API JSON Patch`,
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
    `Publicação da entry ${entry.sys.id} via Management API`,
  );
}

async function createEntry(config, fields, locale, publish) {
  const url = `https://api.contentful.com/spaces/${config.spaceId}/environments/${config.environment}/entries`;
  const createdEntry = await contentfulFetch(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.managementToken}`,
        "Content-Type": "application/vnd.contentful.management.v1+json",
        "X-Contentful-Content-Type": MUNICIPAL_ANALYSIS_CONTENT_TYPE_ID,
      },
      body: JSON.stringify({
        fields: Object.fromEntries(
          Object.entries(fields).map(([fieldId, value]) => [
            fieldId,
            { [locale]: value },
          ]),
        ),
      }),
    },
    "Criação de entry via Management API",
  );

  if (!publish) {
    return createdEntry;
  }

  return contentfulFetch(
    `${url}/${createdEntry.sys.id}/published`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${config.managementToken}`,
        "X-Contentful-Version": String(createdEntry.sys.version),
      },
    },
    `Publicação da entry ${createdEntry.sys.id} via Management API`,
  );
}

async function syncPartitionEntries(config, options, locale) {
  const partitions = await resolvePartitionEntries(options);
  const existingEntries = await listManagementEntriesByPanelLayerId(
    config,
    options.panelLayerId,
    locale,
  );
  const existingByTitle = new Map(
    existingEntries.map((entry) => [getLocalizedField(entry, "title", locale), entry]),
  );
  const reusableEntry = existingEntries.find(
    (entry) =>
      !existingByTitle.has(
        buildPartitionTitle(options.panelLayerId, partitions.at(-1).calendarYear),
      ) &&
      !partitions.some(
        (partition) =>
          buildPartitionTitle(options.panelLayerId, partition.calendarYear) ===
          getLocalizedField(entry, "title", locale),
      ),
  );
  const latestCalendarYear = partitions.at(-1).calendarYear;
  const actions = [];

  for (const partition of partitions) {
    const title = buildPartitionTitle(options.panelLayerId, partition.calendarYear);
    const imageData = await readJson(partition.imageDataPath);
    const targetEntry =
      existingByTitle.get(title) ??
      (partition.calendarYear === latestCalendarYear ? reusableEntry : null);
    const action = targetEntry ? "update" : "create";
    const summary = {
      action,
      title,
      panelLayerId: options.panelLayerId,
      calendarYear: partition.calendarYear,
      entryId: targetEntry?.sys.id ?? null,
      imageDataPath: partition.imageDataPath,
      imageDataBytes: Buffer.byteLength(JSON.stringify(imageData)),
      years: Object.keys(imageData.years ?? {}).length,
      locations: Object.keys(imageData.locations ?? {}).length,
    };

    if (!options.dryRun) {
      const fields = {
        title,
        panelLayerId: options.panelLayerId,
        imageData,
      };
      const updatedEntry = targetEntry
        ? await patchEntryFields(config, targetEntry, fields, locale, options.publish)
        : await createEntry(config, fields, locale, options.publish);

      summary.entryId = updatedEntry.sys.id;
      summary.version = updatedEntry.sys.version;
      summary.publishedAt = updatedEntry.sys.publishedAt;
    }

    actions.push(summary);
  }

  return {
    panelLayerId: options.panelLayerId,
    locale,
    dryRun: options.dryRun,
    publish: options.publish,
    existingEntries: existingEntries.map((entry) => ({
      entryId: entry.sys.id,
      title: getLocalizedField(entry, "title", locale),
      publishedAt: entry.sys.publishedAt,
    })),
    actions,
  };
}

async function main() {
  await loadDotEnv();

  const options = parseArgs(process.argv.slice(2));
  const config = getContentfulConfig();
  const localeCheck = await getDefaultLocale(config, !options.dryRun);
  const locale = localeCheck.locale;

  if (options.syncPartitions) {
    if (localeCheck.warning || !config.managementToken) {
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
      return;
    }

    const summary = await syncPartitionEntries(config, options, locale);
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const imageDataPath = await resolveImageDataPath(options);
  const imageData = await readJson(imageDataPath);
  const imageDataBytes = Buffer.byteLength(JSON.stringify(imageData));
  const currentEntry = await findMunicipalAnalysisEntry(
    config,
    options.panelLayerId,
  );
  const summary = {
    panelLayerId: options.panelLayerId,
    entryId: currentEntry.sys.id,
    title: currentEntry.title,
    current: {
      publishedAt: currentEntry.sys.publishedAt,
      imageDataBytes: Buffer.byteLength(JSON.stringify(currentEntry.imageData ?? {})),
      years: Object.keys(currentEntry.imageData?.years ?? {}).length,
      locations: Object.keys(currentEntry.imageData?.locations ?? {}).length,
    },
    replacement: {
      imageDataPath,
      imageDataBytes,
      years: Object.keys(imageData.years ?? {}).length,
      locations: Object.keys(imageData.locations ?? {}).length,
    },
    locale,
    managementTokenCheck: localeCheck.warning
      ? {
          ok: false,
          error: localeCheck.warning,
        }
      : {
          ok: Boolean(config.managementToken),
        },
    dryRun: options.dryRun || !config.managementToken,
    hasManagementToken: Boolean(config.managementToken),
    publish: options.publish,
  };

  if (options.dryRun || !config.managementToken) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const updatedEntry = await updateEntry(
    config,
    currentEntry.sys.id,
    imageData,
    locale,
    options.publish,
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
