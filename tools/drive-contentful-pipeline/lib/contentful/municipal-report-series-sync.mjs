import {
  CONTENTFUL_WRITE_DELAY_MS,
  contentfulFetch,
  managementBaseUrl,
  sleep,
} from "./client.mjs";
import { ensureMunicipalReportSeriesContentModel } from "./content-types.mjs";
import { createEntry, listManagementEntries, patchEntryFields } from "./entries.mjs";
import { readJson, resolveManifestPath } from "../io/json.mjs";

const CONTENT_TYPE_ID = "municipalReportSeries";
const MAX_IMAGE_DATA_BYTES = 450_000;
const MAX_REQUEST_BYTES = 900_000;

export async function readMunicipalReportSeriesManifest(jsonDir) {
  return readJson(resolveManifestPath(jsonDir, "municipal-report-series-manifest.json"));
}

export function validateMunicipalReportSeriesManifest(manifest) {
  const errors = [];
  const keys = new Set();
  for (const layer of manifest.layers ?? []) {
    for (const shard of layer.shards ?? []) {
      const key = `${layer.panelLayerId}::${layer.datasetVersion}::${shard.shardKey}`;
      if (keys.has(key)) errors.push(`Shard duplicado: ${key}`);
      keys.add(key);
      if (shard.outputBytes > MAX_IMAGE_DATA_BYTES) errors.push(`${key} excede ${MAX_IMAGE_DATA_BYTES} bytes no imageData.`);
      if (shard.requestBytes > MAX_REQUEST_BYTES) errors.push(`${key} excede ${MAX_REQUEST_BYTES} bytes na requisição.`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function isMissingContentTypeQueryError(error) {
  const message = String(error);
  return message.includes("status 404") || (
    message.includes("status 400") &&
    message.includes('"id":"InvalidQuery"') &&
    message.includes('"name":"unknownContentType"')
  );
}

export function normalizePanelLayerCategory(category) {
  if (typeof category !== "string") return category;
  const canonical = new Map([
    ["dados climáticos", "Dados Climáticos"],
    ["dados ambientais", "Dados Ambientais"],
    ["dados socioeconômicos", "Dados Socioeconômicos"],
  ]);
  return canonical.get(category.trim().toLocaleLowerCase("pt-BR")) ?? category;
}

function entryKey(entry, locale) {
  return [
    entry.fields?.panelLayerId?.[locale],
    entry.fields?.datasetVersion?.[locale],
    entry.fields?.shardKey?.[locale],
  ].join("::");
}

export function validateMunicipalReportSeriesActivation(
  existingEntries,
  expectedKeys,
  locale,
) {
  const entriesByKey = new Map();
  for (const entry of existingEntries) {
    const key = entryKey(entry, locale);
    if (!expectedKeys.has(key)) continue;
    const entries = entriesByKey.get(key) ?? [];
    entries.push(entry);
    entriesByKey.set(key, entries);
  }
  const missing = [...expectedKeys].filter((key) => !entriesByKey.has(key));
  const duplicates = [...entriesByKey]
    .filter(([, entries]) => entries.length !== 1)
    .map(([key]) => key);
  const unpublished = [...entriesByKey]
    .filter(([, entries]) => entries.some(
      (entry) => !entry.sys?.publishedAt && !entry.sys?.publishedVersion,
    ))
    .map(([key]) => key);
  return { ok: missing.length === 0 && duplicates.length === 0 && unpublished.length === 0, missing, duplicates, unpublished };
}

function localizedRequestBytes(fields, locale) {
  const localized = Object.fromEntries(
    Object.entries(fields).map(([fieldId, value]) => [fieldId, { [locale]: value }]),
  );
  return Buffer.byteLength(JSON.stringify({ fields: localized }));
}

async function deleteEntry(config, entry, context) {
  const entryUrl = `${managementBaseUrl(config)}/entries/${entry.sys.id}`;
  let current = await contentfulFetch(
    entryUrl,
    { headers: { Authorization: `Bearer ${config.managementToken}` } },
    `Busca de entry obsoleta ${context}`,
  );
  if (current.sys.publishedVersion || current.sys.publishedAt) {
    await contentfulFetch(
      `${entryUrl}/published`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${config.managementToken}`,
          "X-Contentful-Version": String(current.sys.version),
        },
      },
      `Despublicação de entry obsoleta ${context}`,
    );
    current = await contentfulFetch(
      entryUrl,
      { headers: { Authorization: `Bearer ${config.managementToken}` } },
      `Atualização da versão de entry obsoleta ${context}`,
    );
  }
  await contentfulFetch(
    entryUrl,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${config.managementToken}`,
        "X-Contentful-Version": String(current.sys.version),
      },
    },
    `Remoção de entry obsoleta ${context}`,
  );
}

export async function syncMunicipalReportSeries(config, options, locale) {
  const manifest = await readMunicipalReportSeriesManifest(options.jsonDir);
  const validation = validateMunicipalReportSeriesManifest(manifest);
  if (!validation.ok) throw new Error(`Manifesto municipalReportSeries inválido: ${validation.errors.join("; ")}`);
  const layers = options.panelLayerId
    ? (manifest.layers ?? []).filter((layer) => layer.panelLayerId === options.panelLayerId)
    : (manifest.layers ?? []);
  if (options.panelLayerId && layers.length !== 1) {
    throw new Error(`Manifesto sem uma camada única panelLayerId=${options.panelLayerId}.`);
  }

  if (!options.dryRun) await ensureMunicipalReportSeriesContentModel(config);
  let existingEntries = [];
  if (!(options.dryRun && !config.managementToken)) {
    try {
      existingEntries = await listManagementEntries(
        config,
        CONTENT_TYPE_ID,
        locale,
        {},
        "sys,fields.title,fields.panelLayerId,fields.datasetVersion,fields.shardKey",
      );
    } catch (error) {
      // The first dry-run intentionally leaves the content model untouched.
      // Contentful returns 400 InvalidQuery/unknownContentType when a
      // content_type filter references a model that has not been created yet.
      if (!options.dryRun || !isMissingContentTypeQueryError(error)) throw error;
    }
  }
  const existingByKey = new Map(existingEntries.map((entry) => [entryKey(entry, locale), entry]));
  const expectedKeys = new Set(
    layers.flatMap((layer) =>
      (layer.shards ?? []).map((shard) => `${layer.panelLayerId}::${layer.datasetVersion}::${shard.shardKey}`),
    ),
  );
  if (options.activateOnly) {
    const activationValidation = validateMunicipalReportSeriesActivation(
      existingEntries,
      expectedKeys,
      locale,
    );
    if (!activationValidation.ok) {
      throw new Error(
        `Ativação bloqueada: missing=${activationValidation.missing.length}, duplicates=${activationValidation.duplicates.length}, unpublished=${activationValidation.unpublished.length}.`,
      );
    }
  }
  let recordEntitlement = { checked: false, projectedRecords: null, limit: null, warning: "Defina CONTENTFUL_MAX_RECORDS com o entitlement contratado para tornar a validação obrigatória." };
  if (config.managementToken) {
    const entrySummary = await contentfulFetch(
      `${managementBaseUrl(config)}/entries?limit=1`,
      { headers: { Authorization: `Bearer ${config.managementToken}` } },
      "Contagem de records do ambiente Contentful",
    );
    const newRecords = [...expectedKeys].filter((key) => !existingByKey.has(key)).length;
    const projectedRecords = Number(entrySummary.total ?? 0) + newRecords;
    const limit = Number(process.env.CONTENTFUL_MAX_RECORDS);
    recordEntitlement = Number.isFinite(limit) && limit > 0
      ? { checked: true, projectedRecords, limit, warning: null }
      : { checked: false, projectedRecords, limit: null, warning: "Defina CONTENTFUL_MAX_RECORDS com o entitlement contratado para tornar a validação obrigatória." };
    if (recordEntitlement.checked && projectedRecords > limit) {
      throw new Error(`Publicação projetaria ${projectedRecords} records, acima do entitlement ${limit}.`);
    }
  }
  const actions = [];

  // Shards are fully written and optionally published before panelLayer is activated.
  // A later rollout can use activateOnly after publication has been audited.
  if (!options.activateOnly) {
    for (const layer of layers) {
      for (const shard of layer.shards ?? []) {
        const imageData = await readJson(shard.imageDataPath);
        const fields = {
          title: shard.title,
          panelLayerId: layer.panelLayerId,
          shardKey: shard.shardKey,
          datasetVersion: layer.datasetVersion,
          imageData,
        };
        const key = `${layer.panelLayerId}::${layer.datasetVersion}::${shard.shardKey}`;
        const actualOutputBytes = Buffer.byteLength(JSON.stringify(imageData));
        const actualRequestBytes = localizedRequestBytes(fields, locale);
        if (actualOutputBytes !== shard.outputBytes) {
          throw new Error(`${key} diverge do manifesto: imageData ${actualOutputBytes}/${shard.outputBytes} bytes.`);
        }
        if (actualOutputBytes > MAX_IMAGE_DATA_BYTES || actualRequestBytes > MAX_REQUEST_BYTES) {
          throw new Error(`${key} excede limites reais: imageData=${actualOutputBytes}, request=${actualRequestBytes}.`);
        }
        const current = existingByKey.get(key);
        if (options.dryRun) {
          actions.push({ action: current ? "update" : "create", key, dryRun: true });
        } else if (current) {
          await patchEntryFields(config, current, fields, locale, options.publish, key);
          actions.push({ action: "update", key });
        } else {
          await createEntry(config, CONTENT_TYPE_ID, fields, locale, options.publish, key);
          actions.push({ action: "create", key });
        }
        if (!options.dryRun) await sleep(CONTENTFUL_WRITE_DELAY_MS);
      }
    }
  }

  const activations = [];
  for (const layer of layers) {
    if (!options.activate) continue;
    if (options.dryRun) {
      activations.push({ panelLayerId: layer.panelLayerId, config: layer.reportSeriesConfig, dryRun: true });
      continue;
    }
    const panelLayers = await listManagementEntries(
      config,
      "panelLayer",
      locale,
      { id: layer.panelLayerId },
      "sys,fields.id,fields.category,fields.reportSeriesConfig",
    );
    if (panelLayers.length !== 1) throw new Error(`Esperado um panelLayer id=${layer.panelLayerId}; encontrado ${panelLayers.length}.`);
    const currentCategory = panelLayers[0].fields?.category?.[locale];
    const normalizedCategory = normalizePanelLayerCategory(currentCategory);
    await patchEntryFields(
      config,
      panelLayers[0],
      {
        reportSeriesConfig: layer.reportSeriesConfig,
        ...(normalizedCategory !== currentCategory
          ? { category: normalizedCategory }
          : {}),
      },
      locale,
      options.publish,
      `ativação municipalReportSeries ${layer.panelLayerId}`,
    );
    activations.push({ panelLayerId: layer.panelLayerId, config: layer.reportSeriesConfig });
    await sleep(CONTENTFUL_WRITE_DELAY_MS);
  }

  const pruned = [];
  if (options.pruneOld) {
    if (!options.activate || !options.publish || options.dryRun) {
      throw new Error("--prune-old exige --publish e --activate para só remover versões após a ativação.");
    }
    const activeLayerIds = new Set(layers.map((layer) => layer.panelLayerId));
    const staleEntries = existingEntries.filter((entry) => {
      const panelLayerId = entry.fields?.panelLayerId?.[locale];
      return activeLayerIds.has(panelLayerId) && !expectedKeys.has(entryKey(entry, locale));
    });
    for (const entry of staleEntries) {
      const key = entryKey(entry, locale);
      await deleteEntry(config, entry, key);
      pruned.push(key);
      await sleep(CONTENTFUL_WRITE_DELAY_MS);
    }
  }

  return { validation, recordEntitlement, dryRun: options.dryRun, publish: options.publish, actions, activations, pruned };
}
