import { getLocalizedField } from "./client.mjs";
import { listManagementEntries, patchEntryFields } from "./entries.mjs";
import { readJson, resolveManifestPath } from "../io/json.mjs";
import { validatePanelLayerImageData } from "../validation/panel-layer.mjs";

const CONTENT_TYPE_ID = "panelLayer";

export async function readPanelLayerManifest(jsonDir) {
  return readJson(
    resolveManifestPath(jsonDir, "panel-layer-imageData-manifest.json"),
  );
}

export async function resolveImageDataEntries(options) {
  if (options.imageDataPath) {
    return [
      {
        panelLayerId: options.panelLayerId,
        imageDataPath: options.imageDataPath,
      },
    ];
  }

  const manifest = await readPanelLayerManifest(options.jsonDir);
  const entries = Array.isArray(manifest.panelLayers)
    ? manifest.panelLayers
    : [];

  if (options.allPanelLayers) {
    if (entries.length === 0)
      throw new Error("Manifesto sem panelLayers para sincronizar.");
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
  const matches = await listManagementEntries(
    config,
    CONTENT_TYPE_ID,
    locale,
    { id: panelLayerId },
    "sys,fields.id,fields.name,fields.imageData",
  );

  if (matches.length !== 1) {
    throw new Error(
      `Esperado 1 panelLayer com id=${panelLayerId}, encontrado ${matches.length}.`,
    );
  }

  return matches[0];
}

export async function syncPanelLayerImageData(
  config,
  options,
  locale,
  manifestEntry,
) {
  const imageData = await readJson(manifestEntry.imageDataPath);
  const validationErrors = validatePanelLayerImageData(
    imageData,
    manifestEntry.imageDataPath,
  );

  if (validationErrors.length > 0) {
    throw new Error(
      `Validação do imageData panelLayer falhou: ${JSON.stringify(validationErrors, null, 2)}`,
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

  if (options.dryRun) return summary;

  const updatedEntry = await patchEntryFields(
    config,
    currentEntry,
    { imageData },
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

export { validatePanelLayerImageData };
