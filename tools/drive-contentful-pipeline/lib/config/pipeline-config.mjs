import { readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_CONFIG_PATH =
  "tools/drive-contentful-pipeline/config/pipeline-config.json";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(
      `${label} deve ser string não vazia; recebido ${JSON.stringify(value)}.`,
    );
  }
}

function compilePattern(pattern, label) {
  assertString(pattern, label);

  try {
    return new RegExp(pattern, "iu");
  } catch (error) {
    throw new Error(
      `${label} contém regex inválida ${JSON.stringify(pattern)}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function normalizeLayerRule(rule, index) {
  if (!isRecord(rule)) {
    throw new Error(
      `layerRules[${index}] deve ser objeto; recebido ${JSON.stringify(rule)}.`,
    );
  }

  for (const field of ["key", "label", "panelLayerId"]) {
    assertString(rule[field], `layerRules[${index}].${field}`);
  }

  if (!Array.isArray(rule.patterns) || rule.patterns.length === 0) {
    throw new Error(`layerRules[${index}].patterns deve ser lista não vazia.`);
  }

  return {
    ...rule,
    patterns: rule.patterns.map((pattern, patternIndex) =>
      compilePattern(pattern, `layerRules[${index}].patterns[${patternIndex}]`),
    ),
    patternSources: rule.patterns,
  };
}

function validatePanelLayerProfile(profile, panelLayerId) {
  if (!isRecord(profile)) {
    throw new Error(`panelLayerProfiles.${panelLayerId} deve ser objeto.`);
  }

  if (!Array.isArray(profile.classes) || profile.classes.length === 0) {
    throw new Error(
      `panelLayerProfiles.${panelLayerId}.classes deve ser lista não vazia.`,
    );
  }

  if (!isRecord(profile.templates)) {
    throw new Error(
      `panelLayerProfiles.${panelLayerId}.templates deve ser objeto.`,
    );
  }

  if (!isRecord(profile.mapVisualization)) {
    throw new Error(
      `panelLayerProfiles.${panelLayerId}.mapVisualization deve ser objeto.`,
    );
  }
}

function normalizePipelineConfig(config) {
  if (!isRecord(config)) {
    throw new Error("pipeline-config.json deve conter um objeto JSON.");
  }

  assertString(config.drive?.folderId, "drive.folderId");
  assertString(config.paths?.csvDir, "paths.csvDir");
  assertString(config.paths?.jsonDir, "paths.jsonDir");
  assertString(config.defaults?.fileNamePattern, "defaults.fileNamePattern");

  if (!Number.isFinite(config.limits?.maxContentfulJsonBytes)) {
    throw new Error("limits.maxContentfulJsonBytes deve ser número finito.");
  }

  if (!Number.isFinite(config.limits?.compressedDataChunkSize)) {
    throw new Error("limits.compressedDataChunkSize deve ser número finito.");
  }

  const panelLayerProfiles = config.panelLayerProfiles ?? {};

  for (const [panelLayerId, profile] of Object.entries(panelLayerProfiles)) {
    validatePanelLayerProfile(profile, panelLayerId);
  }

  return {
    ...config,
    layerRules: config.layerRules.map(normalizeLayerRule),
    fileNamePattern: compilePattern(
      config.defaults.fileNamePattern,
      "defaults.fileNamePattern",
    ),
    panelLayerProfiles,
  };
}

export async function loadPipelineConfig(configPath = DEFAULT_CONFIG_PATH) {
  const absolutePath = path.resolve(process.cwd(), configPath);
  const config = JSON.parse(await readFile(absolutePath, "utf8"));

  return normalizePipelineConfig(config);
}

export { normalizePipelineConfig };
