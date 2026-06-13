import path from "node:path";
import { gunzipSync } from "node:zlib";
import {
  validateCompressedTerritorialEnvelope,
  validateImageDataContract,
} from "../../../../src/contracts/imageDataContract.mjs";
import { isRecord } from "../shared/records.mjs";
import { readJson } from "../io/json.mjs";

function isCompressedMunicipalAnalysisImageData(value) {
  return (
    isRecord(value) &&
    value.type === "territorial-compact-compressed" &&
    value.encoding === "gzip+base64" &&
    (typeof value.data === "string" ||
      (Array.isArray(value.data) &&
        value.data.every((chunk) => typeof chunk === "string")))
  );
}

function isPlainMunicipalAnalysisImageData(value) {
  return (
    validateImageDataContract(value, { context: "runtimeRead" }).ok &&
    isRecord(value) &&
    value.type === "territorial-compact"
  );
}

function isMunicipalAnalysisPatchImageData(value) {
  return validateImageDataContract(value, { context: "municipalPatch" }).ok;
}

function decodeCompressedMunicipalAnalysisImageData(imageData) {
  const encoded = Array.isArray(imageData.data)
    ? imageData.data.join("")
    : imageData.data;

  return JSON.parse(
    gunzipSync(Buffer.from(encoded, "base64")).toString("utf8"),
  );
}

export function validateMunicipalAnalysisImageData(imageData, context = "") {
  const prefix = context ? `${context}: ` : "";

  if (
    isPlainMunicipalAnalysisImageData(imageData) ||
    isMunicipalAnalysisPatchImageData(imageData)
  ) {
    return [];
  }

  if (isCompressedMunicipalAnalysisImageData(imageData)) {
    const envelopeValidation = validateCompressedTerritorialEnvelope(imageData);

    if (!envelopeValidation.ok) {
      return envelopeValidation.errors.map((error) => `${prefix}${error}`);
    }

    try {
      const decoded = decodeCompressedMunicipalAnalysisImageData(imageData);

      if (
        isPlainMunicipalAnalysisImageData(decoded) ||
        isMunicipalAnalysisPatchImageData(decoded)
      ) {
        return [];
      }

      return [
        `${prefix}payload gzip+base64 deve descomprimir para imageData territorial-compact ou patch municipal válido.`,
      ];
    } catch (error) {
      return [
        `${prefix}payload gzip+base64 inválido: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ];
    }
  }

  return [
    `${prefix}imageData deve ter years ou ser envelope gzip+base64 territorial-compact-compressed.`,
  ];
}

function validatePartitionManifestEntry(partition, index) {
  const errors = [];
  const label = `partitions[${index}]`;

  if (!isRecord(partition)) {
    return [`${label}: partição inválida.`];
  }

  for (const field of [
    "panelLayerId",
    "partitionKey",
    "calendarYear",
    "territory",
    "imageDataPath",
  ]) {
    if (typeof partition[field] !== "string" || !partition[field].trim()) {
      errors.push(`${label}.${field}: campo obrigatório ausente.`);
    }
  }

  if (
    !Array.isArray(partition.yearKeys) ||
    partition.yearKeys.length === 0 ||
    !partition.yearKeys.every((yearKey) => typeof yearKey === "string")
  ) {
    errors.push(`${label}.yearKeys: deve ser uma lista não vazia de strings.`);
  }

  return errors;
}

export async function validateMunicipalAnalysisManifest(
  manifest,
  _jsonDir,
  readJsonFile = readJson,
) {
  const errors = [];
  const warnings = [];

  if (!isRecord(manifest)) {
    return { ok: false, errors: ["Manifesto inválido."], warnings };
  }

  const partitions = Array.isArray(manifest.partitions)
    ? manifest.partitions
    : [];
  const partitionKeys = new Set();
  const routePartitionKeys = new Set();

  if (partitions.length === 0)
    warnings.push("Manifesto sem partições mapeadas.");

  for (const [index, partition] of partitions.entries()) {
    errors.push(...validatePartitionManifestEntry(partition, index));
    if (!isRecord(partition)) continue;

    const duplicateKey = [
      partition.panelLayerId,
      partition.partitionKey,
      partition.territory,
    ].join("::");
    const routePartitionKey = [
      partition.panelLayerId,
      partition.partitionKey,
    ].join("::");

    if (partitionKeys.has(duplicateKey)) {
      errors.push(
        `partitions[${index}]: partição duplicada para ${duplicateKey}.`,
      );
    } else {
      partitionKeys.add(duplicateKey);
    }

    if (routePartitionKeys.has(routePartitionKey)) {
      errors.push(
        `partitions[${index}]: partição ambígua para rota ${routePartitionKey}; use partitionKey exclusivo por panelLayerId.`,
      );
    } else {
      routePartitionKeys.add(routePartitionKey);
    }

    if (typeof partition.imageDataPath !== "string") continue;

    const imageDataPath = path.isAbsolute(partition.imageDataPath)
      ? partition.imageDataPath
      : path.resolve(process.cwd(), partition.imageDataPath);

    try {
      const imageData = await readJsonFile(imageDataPath);
      errors.push(
        ...validateMunicipalAnalysisImageData(
          imageData,
          `partitions[${index}].imageData`,
        ),
      );
    } catch (error) {
      errors.push(
        `partitions[${index}].imageDataPath: não foi possível ler ${partition.imageDataPath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
