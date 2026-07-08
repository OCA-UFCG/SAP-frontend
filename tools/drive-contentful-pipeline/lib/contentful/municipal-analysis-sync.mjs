import {
  graphQlUrl,
  contentfulFetch,
  getLocalizedField,
  sleep,
  CONTENTFUL_WRITE_DELAY_MS,
} from "./client.mjs";
import {
  createEntry,
  listManagementEntries,
  patchEntryFields,
} from "./entries.mjs";
import {
  dryRunMunicipalAnalysisPartitionFields,
  ensureMunicipalAnalysisPartitionFields,
} from "./content-types.mjs";
import { readJson, resolveManifestPath } from "../io/json.mjs";
import {
  validateMunicipalAnalysisImageData,
  validateMunicipalAnalysisManifest,
} from "../validation/municipal-analysis.mjs";

const CONTENT_TYPE_ID = "municipalAnalysis";
const STALE_PANEL_LAYER_SUFFIX = "_legacy_disabled";

export async function readMunicipalAnalysisManifest(jsonDir) {
  return readJson(
    resolveManifestPath(jsonDir, "municipal-analysis-manifest.json"),
  );
}

export function getPartitionKey(partition) {
  return partition.partitionKey ?? partition.calendarYear;
}

export function buildPartitionTitle(panelLayerId, partition) {
  return `Municipal Analysis ${panelLayerId} ${getPartitionKey(partition)}`;
}

export async function findMunicipalAnalysisEntry(config, panelLayerId) {
  const query = `
    query FindMunicipalAnalysis($preview: Boolean!) {
      municipalAnalysisCollection(limit: 100, preview: $preview) {
        items { sys { id publishedAt } title panelLayerId imageData }
      }
    }
  `;
  const data = await contentfulFetch(
    graphQlUrl(config),
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

  if (data.errors?.length)
    throw new Error(JSON.stringify(data.errors, null, 2));

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

export async function resolveImageDataPath(options) {
  if (options.imageDataPath) return options.imageDataPath;

  const manifest = await readMunicipalAnalysisManifest(options.jsonDir);
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

export async function resolvePartitionEntries(options) {
  const manifest = await readMunicipalAnalysisManifest(options.jsonDir);
  const partitions = (manifest.partitions ?? [])
    .filter((item) => item.panelLayerId === options.panelLayerId)
    .sort((left, right) =>
      getPartitionKey(left).localeCompare(getPartitionKey(right)),
    );

  if (partitions.length === 0) {
    throw new Error(
      `Manifesto sem partições para panelLayerId=${options.panelLayerId}.`,
    );
  }

  return partitions;
}

export async function resolveAllPanelLayerIds(options) {
  const manifest = await readMunicipalAnalysisManifest(options.jsonDir);
  const panelLayerIds = new Set();

  for (const partition of manifest.partitions ?? []) {
    if (partition.panelLayerId) panelLayerIds.add(partition.panelLayerId);
  }

  return [...panelLayerIds].sort((left, right) => left.localeCompare(right));
}

function getCalendarYear(value) {
  return String(value).match(/^(\d{4})(?:-\d{2})?$/u)?.[1] ?? null;
}

function findMatchingPanelLayerYear(panelLayerYearKeys, municipalYearKey) {
  if (panelLayerYearKeys.includes(municipalYearKey)) return municipalYearKey;

  const calendarYear = getCalendarYear(municipalYearKey);
  if (!calendarYear) return null;

  const matches = panelLayerYearKeys.filter(
    (panelLayerYearKey) => getCalendarYear(panelLayerYearKey) === calendarYear,
  );

  return matches.length === 1 ? matches[0] : null;
}

async function getPanelLayerYearKeys(config, panelLayerId) {
  const query = `
    query GetPanelLayerYears($preview: Boolean!, $panelLayerId: String!) {
      panelLayerCollection(limit: 1, preview: $preview, where: { id: $panelLayerId }) {
        items { id imageData }
      }
    }
  `;
  const data = await contentfulFetch(
    graphQlUrl(config),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.deliveryToken}`,
      },
      body: JSON.stringify({
        query,
        variables: { preview: config.usePreview, panelLayerId },
      }),
    },
    `Consulta do panelLayer ${panelLayerId} para validação de anos`,
  );

  if (data.errors?.length)
    throw new Error(JSON.stringify(data.errors, null, 2));

  const imageData = data.data?.panelLayerCollection?.items?.[0]?.imageData;
  if (!imageData || typeof imageData !== "object") return [];

  if (
    imageData.type === "territorial-compact" &&
    imageData.years &&
    typeof imageData.years === "object"
  ) {
    return Object.keys(imageData.years);
  }

  return Object.keys(imageData);
}

async function validatePartitionsAgainstPanelLayer(
  config,
  panelLayerId,
  partitions,
  expectedPanelLayerYearKeys,
) {
  const panelLayerYearKeys =
    expectedPanelLayerYearKeys ??
    (await getPanelLayerYearKeys(config, panelLayerId));

  return {
    panelLayerYearKeys,
    missingPanelLayerYears: partitions.flatMap((partition) =>
      partition.yearKeys
        .filter(
          (yearKey) => !findMatchingPanelLayerYear(panelLayerYearKeys, yearKey),
        )
        .map((yearKey) => ({
          panelLayerId,
          partitionKey: getPartitionKey(partition),
          yearKey,
          imageDataPath: partition.imageDataPath,
        })),
    ),
  };
}

export async function syncPartitionEntries(config, options, locale) {
  const contentModelUpdate = options.dryRun
    ? dryRunMunicipalAnalysisPartitionFields()
    : await ensureMunicipalAnalysisPartitionFields(config, CONTENT_TYPE_ID);
  const partitions = await resolvePartitionEntries(options);
  const manifest = await readMunicipalAnalysisManifest(options.jsonDir);
  const manifestValidation = await validateMunicipalAnalysisManifest(
    manifest,
    options.jsonDir,
  );

  if (!manifestValidation.ok) {
    throw new Error(
      `Validação do manifesto municipalAnalysis falhou: ${JSON.stringify(manifestValidation, null, 2)}`,
    );
  }

  const validation = await validatePartitionsAgainstPanelLayer(
    config,
    options.panelLayerId,
    partitions,
    options.expectedPanelLayerYearKeys?.[options.panelLayerId],
  );
  const existingEntries = await listManagementEntries(
    config,
    CONTENT_TYPE_ID,
    locale,
    { panelLayerId: options.panelLayerId },
    "sys,fields.title,fields.panelLayerId",
  );
  const actions = await syncExpectedPartitions(
    config,
    options,
    locale,
    partitions,
    existingEntries,
  );
  const staleEntryActions = await disableStaleEntries(
    config,
    options,
    locale,
    partitions,
    existingEntries,
    actions,
  );

  return {
    panelLayerId: options.panelLayerId,
    locale,
    dryRun: options.dryRun,
    publish: options.publish,
    contentModelUpdate,
    manifestValidation,
    validation,
    existingEntries: existingEntries.map((entry) => ({
      entryId: entry.sys.id,
      title: getLocalizedField(entry, "title", locale),
      publishedAt: entry.sys.publishedAt,
    })),
    actions,
    staleEntryActions,
  };
}

async function syncExpectedPartitions(
  config,
  options,
  locale,
  partitions,
  existingEntries,
) {
  const existingByTitle = new Map(
    existingEntries.map((entry) => [
      getLocalizedField(entry, "title", locale),
      entry,
    ]),
  );
  const latestPartition = partitions.at(-1);
  const reusableEntry = findReusableEntry(
    existingEntries,
    existingByTitle,
    partitions,
    latestPartition,
    options.panelLayerId,
    locale,
  );
  const latestPartitionKey = getPartitionKey(latestPartition);
  const actions = [];

  for (const partition of partitions) {
    const partitionKey = getPartitionKey(partition);
    const title = buildPartitionTitle(options.panelLayerId, partition);
    const imageData = await readJson(partition.imageDataPath);
    const targetEntry =
      existingByTitle.get(title) ??
      (partitionKey === latestPartitionKey ? reusableEntry : null);
    const summary = buildPartitionActionSummary(
      options,
      partition,
      partitionKey,
      title,
      imageData,
      targetEntry,
    );

    if (!options.dryRun) {
      const fields = {
        title,
        panelLayerId: options.panelLayerId,
        partitionKey,
        calendarYear: partition.calendarYear,
        territory: partition.territory,
        imageData,
      };
      const updatedEntry = targetEntry
        ? await patchEntryFields(
            config,
            targetEntry,
            fields,
            locale,
            options.publish,
            `${title} (${partition.imageDataPath})`,
          )
        : await createEntry(
            config,
            CONTENT_TYPE_ID,
            fields,
            locale,
            options.publish,
            `${title} (${partition.imageDataPath})`,
          );
      Object.assign(summary, {
        entryId: updatedEntry.sys.id,
        version: updatedEntry.sys.version,
        publishedAt: updatedEntry.sys.publishedAt,
      });
      await sleep(CONTENTFUL_WRITE_DELAY_MS);
    }

    actions.push(summary);
  }

  return actions;
}

function findReusableEntry(
  existingEntries,
  existingByTitle,
  partitions,
  latestPartition,
  panelLayerId,
  locale,
) {
  const latestTitle = buildPartitionTitle(panelLayerId, latestPartition);

  return existingEntries.find(
    (entry) =>
      !existingByTitle.has(latestTitle) &&
      !partitions.some(
        (partition) =>
          buildPartitionTitle(panelLayerId, partition) ===
          getLocalizedField(entry, "title", locale),
      ),
  );
}

function buildPartitionActionSummary(
  options,
  partition,
  partitionKey,
  title,
  imageData,
  targetEntry,
) {
  return {
    action: targetEntry ? "update" : "create",
    title,
    panelLayerId: options.panelLayerId,
    partitionKey,
    calendarYear: partition.calendarYear,
    entryId: targetEntry?.sys.id ?? null,
    imageDataPath: partition.imageDataPath,
    imageDataBytes: Buffer.byteLength(JSON.stringify(imageData)),
    encoding: imageData.encoding ?? "identity",
    rawBytes: imageData.rawBytes,
    compressedBytes: imageData.compressedBytes,
    years: partition.yearKeys.length,
    locations: partition.locationCount,
  };
}

async function disableStaleEntries(
  config,
  options,
  locale,
  partitions,
  existingEntries,
  partitionActions,
) {
  const expectedTitles = new Set(
    partitions.map((partition) =>
      buildPartitionTitle(options.panelLayerId, partition),
    ),
  );
  const reusedEntryIds = new Set(
    partitionActions.flatMap((action) =>
      action.entryId ? [action.entryId] : [],
    ),
  );
  const staleEntries = existingEntries.filter(
    (entry) =>
      !expectedTitles.has(getLocalizedField(entry, "title", locale)) &&
      !reusedEntryIds.has(entry.sys.id),
  );
  const actions = [];

  for (const staleEntry of staleEntries) {
    const summary = {
      action: "disable-stale",
      entryId: staleEntry.sys.id,
      title: getLocalizedField(staleEntry, "title", locale),
      fromPanelLayerId: options.panelLayerId,
      toPanelLayerId: `${options.panelLayerId}${STALE_PANEL_LAYER_SUFFIX}`,
      publishedAt: staleEntry.sys.publishedAt,
    };

    if (!options.dryRun) {
      const updatedEntry = await patchEntryFields(
        config,
        staleEntry,
        { panelLayerId: summary.toPanelLayerId },
        locale,
        options.publish,
        `desativação de entry antiga ${staleEntry.sys.id}`,
      );
      summary.version = updatedEntry.sys.version;
      summary.publishedAt = updatedEntry.sys.publishedAt;
      await sleep(CONTENTFUL_WRITE_DELAY_MS);
    }

    actions.push(summary);
  }

  return actions;
}

export function summarizePartitionSyncResult(result) {
  const actionCounts = result.actions.reduce(
    (counts, action) => ({
      ...counts,
      [action.action]: (counts[action.action] ?? 0) + 1,
    }),
    {},
  );

  return {
    panelLayerId: result.panelLayerId,
    partitions: result.actions.length,
    existingEntries: result.existingEntries.length,
    staleEntries: result.staleEntryActions.length,
    missingPanelLayerYears: result.validation.missingPanelLayerYears.length,
    warnings:
      result.validation.missingPanelLayerYears.length +
      result.manifestValidation.warnings.length,
    blockingValidationErrors: result.manifestValidation.errors.length,
    actions: actionCounts,
  };
}

export { validateMunicipalAnalysisImageData };
