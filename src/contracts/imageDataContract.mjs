export const TERRITORIAL_COMPACT_SCHEMA_VERSION = 1;

const VALID_CONTEXTS = new Set([
  "runtimeRead",
  "panelLayerPublish",
  "municipalPatch",
  "compressedMunicipalPatch",
]);

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function pushError(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function isStringRecord(value) {
  return (
    isRecord(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

function isNumericArrayRecord(value) {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (entry) =>
        Array.isArray(entry) && entry.every((item) => isFiniteNumber(item)),
    )
  );
}

function validateClassList(value, path, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    pushError(errors, path, "deve ser uma lista não vazia.");
    return;
  }

  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;

    if (!isRecord(entry)) {
      pushError(errors, entryPath, "deve ser um objeto.");
      return;
    }

    for (const field of ["id", "label", "color"]) {
      if (!isNonEmptyString(entry[field])) {
        pushError(errors, `${entryPath}.${field}`, "deve ser string não vazia.");
      }
    }

    if (entry.pixelLimit != null && !isFiniteNumber(entry.pixelLimit)) {
      pushError(errors, `${entryPath}.pixelLimit`, "deve ser número finito.");
    }
  });
}

function validateOptionalStringRecord(value, path, errors) {
  if (value == null) return;

  if (!isStringRecord(value)) {
    pushError(errors, path, "deve ser um objeto de strings.");
  }
}

function validateTemplates(value, path, errors) {
  if (value == null) return;

  if (!isRecord(value)) {
    pushError(errors, path, "deve ser um objeto.");
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (entry != null && typeof entry !== "string") {
      pushError(errors, `${path}.${key}`, "deve ser string.");
    }
  }
}

function validateRanking(value, path, errors) {
  if (value == null) return;

  if (!isRecord(value)) {
    pushError(errors, path, "deve ser um objeto.");
    return;
  }

  for (const field of ["title", "totalLabel"]) {
    if (value[field] != null && typeof value[field] !== "string") {
      pushError(errors, `${path}.${field}`, "deve ser string.");
    }
  }
}

function validateMapVisualization(value, path, errors) {
  if (value == null) return;

  if (!isRecord(value)) {
    pushError(errors, path, "deve ser um objeto.");
    return;
  }

  if (
    value.sourceType != null &&
    !["image", "imageCollection", "featureCollection"].includes(
      value.sourceType,
    )
  ) {
    pushError(
      errors,
      `${path}.sourceType`,
      "deve ser image, imageCollection ou featureCollection.",
    );
  }

  for (const field of ["min", "max"]) {
    if (value[field] != null && !isFiniteNumber(value[field])) {
      pushError(errors, `${path}.${field}`, "deve ser número finito.");
    }
  }

  if (
    value.palette != null &&
    (!Array.isArray(value.palette) ||
      value.palette.some((item) => !isNonEmptyString(item)))
  ) {
    pushError(errors, `${path}.palette`, "deve ser lista de strings.");
  }

  if (value.legend != null) {
    validateClassList(value.legend, `${path}.legend`, errors);
  }

  for (const field of ["band", "sourceBand", "property"]) {
    if (value[field] != null && !isNonEmptyString(value[field])) {
      pushError(errors, `${path}.${field}`, "deve ser string não vazia.");
    }
  }

  if (value.outline != null) {
    if (!isRecord(value.outline)) {
      pushError(errors, `${path}.outline`, "deve ser um objeto.");
    } else {
      if (
        value.outline.color != null &&
        !isNonEmptyString(value.outline.color)
      ) {
        pushError(errors, `${path}.outline.color`, "deve ser string não vazia.");
      }

      for (const field of ["width", "opacity"]) {
        if (
          value.outline[field] != null &&
          !isFiniteNumber(value.outline[field])
        ) {
          pushError(errors, `${path}.outline.${field}`, "deve ser número finito.");
        }
      }
    }
  }

  if (
    value.thresholds != null &&
    (!Array.isArray(value.thresholds) ||
      value.thresholds.some((item) => !isFiniteNumber(item)))
  ) {
    pushError(errors, `${path}.thresholds`, "deve ser lista de números.");
  }

  if (value.sourceRange != null) {
    if (!isRecord(value.sourceRange)) {
      pushError(errors, `${path}.sourceRange`, "deve ser um objeto.");
    } else {
      for (const field of ["min", "max"]) {
        if (
          value.sourceRange[field] != null &&
          !isFiniteNumber(value.sourceRange[field])
        ) {
          pushError(
            errors,
            `${path}.sourceRange.${field}`,
            "deve ser número finito.",
          );
        }
      }

      if (
        value.sourceRange.unit != null &&
        !isNonEmptyString(value.sourceRange.unit)
      ) {
        pushError(errors, `${path}.sourceRange.unit`, "deve ser string não vazia.");
      }
    }
  }

  validateOptionalStringRecord(value.valueMeaning, `${path}.valueMeaning`, errors);
}

function validateYears(value, path, errors, options) {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    pushError(errors, path, "deve ser um objeto não vazio.");
    return;
  }

  for (const [yearKey, yearEntry] of Object.entries(value)) {
    const yearPath = `${path}.${yearKey}`;

    if (!isRecord(yearEntry)) {
      pushError(errors, yearPath, "deve ser um objeto.");
      continue;
    }

    if (options.requireImageId && !isNonEmptyString(yearEntry.imageId)) {
      pushError(errors, `${yearPath}.imageId`, "deve ser string não vazia.");
    } else if (
      !options.requireImageId &&
      yearEntry.imageId != null &&
      !isNonEmptyString(yearEntry.imageId)
    ) {
      pushError(errors, `${yearPath}.imageId`, "deve ser string não vazia.");
    }

    if (yearEntry.year != null && typeof yearEntry.year !== "string") {
      pushError(errors, `${yearPath}.year`, "deve ser string.");
    }

    if (
      yearEntry.valuesScale != null &&
      !isFiniteNumber(yearEntry.valuesScale)
    ) {
      pushError(errors, `${yearPath}.valuesScale`, "deve ser número finito.");
    }

    if (options.requireValues || yearEntry.values != null) {
      if (!isNumericArrayRecord(yearEntry.values)) {
        pushError(errors, `${yearPath}.values`, "deve ser objeto de arrays numéricos.");
      }
    }
  }
}

function validateCompactDataset(value, context, errors) {
  const isPanelLayerPublish = context === "panelLayerPublish";
  const isRuntimeRead = context === "runtimeRead";

  if (value.schemaVersion !== TERRITORIAL_COMPACT_SCHEMA_VERSION) {
    pushError(
      errors,
      "schemaVersion",
      `deve ser ${TERRITORIAL_COMPACT_SCHEMA_VERSION}; recebido ${JSON.stringify(
        value.schemaVersion,
      )}.`,
    );
  }

  if (value.type !== "territorial-compact") {
    pushError(errors, "type", "deve ser territorial-compact.");
  }

  validateClassList(value.classes, "classes", errors);

  if (isPanelLayerPublish) {
    if (
      typeof value.defaultYear !== "string" ||
      !isRecord(value.years) ||
      !value.years[value.defaultYear]
    ) {
      pushError(errors, "defaultYear", "deve existir em years.");
    }

    if (
      !isRecord(value.locations) ||
      Object.keys(value.locations).length === 0 ||
      !Object.values(value.locations).every((entry) => typeof entry === "string")
    ) {
      pushError(errors, "locations", "deve ser um objeto não vazio de strings.");
    }
  } else {
    validateOptionalStringRecord(value.locations, "locations", errors);
  }

  validateTemplates(value.templates, "templates", errors);
  validateRanking(value.ranking, "ranking", errors);
  validateMapVisualization(value.mapVisualization, "mapVisualization", errors);
  validateYears(value.years, "years", errors, {
    requireImageId: true,
    requireValues: !isRuntimeRead,
  });
}

function validateMunicipalPatch(value, errors) {
  if (!isRecord(value.years) || Object.keys(value.years).length === 0) {
    pushError(errors, "years", "deve ser um objeto não vazio.");
    return;
  }

  if (
    value.schemaVersion != null &&
    value.schemaVersion !== TERRITORIAL_COMPACT_SCHEMA_VERSION
  ) {
    pushError(
      errors,
      "schemaVersion",
      `deve ser ${TERRITORIAL_COMPACT_SCHEMA_VERSION}; recebido ${JSON.stringify(
        value.schemaVersion,
      )}.`,
    );
  }

  if (value.type != null && value.type !== "territorial-compact") {
    pushError(errors, "type", "deve ser territorial-compact quando informado.");
  }

  if (value.classes != null) {
    validateClassList(value.classes, "classes", errors);
  }

  validateOptionalStringRecord(value.locations, "locations", errors);
  validateTemplates(value.templates, "templates", errors);
  validateRanking(value.ranking, "ranking", errors);
  validateMapVisualization(value.mapVisualization, "mapVisualization", errors);
  validateYears(value.years, "years", errors, {
    requireImageId: false,
    requireValues: true,
  });
}

function isLegacyImageDataEntry(value) {
  return (
    isRecord(value) &&
    typeof value.default === "boolean" &&
    isNonEmptyString(value.imageId) &&
    Array.isArray(value.imageParams)
  );
}

export function isLegacyImageDataMap(value) {
  return (
    isRecord(value) &&
    Object.keys(value).length > 0 &&
    Object.values(value).every(isLegacyImageDataEntry)
  );
}

export function validateCompressedTerritorialEnvelope(value) {
  const errors = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["imageData: deve ser um objeto."] };
  }

  if (value.schemaVersion != null && value.schemaVersion !== 1) {
    pushError(
      errors,
      "schemaVersion",
      `deve ser 1; recebido ${JSON.stringify(value.schemaVersion)}.`,
    );
  }

  if (value.type !== "territorial-compact-compressed") {
    pushError(errors, "type", "deve ser territorial-compact-compressed.");
  }

  if (value.encoding !== "gzip+base64") {
    pushError(errors, "encoding", "deve ser gzip+base64.");
  }

  if (
    !(
      typeof value.data === "string" ||
      (Array.isArray(value.data) &&
        value.data.length > 0 &&
        value.data.every((chunk) => typeof chunk === "string"))
    )
  ) {
    pushError(errors, "data", "deve ser string ou lista não vazia de strings.");
  }

  for (const field of ["mediaType"]) {
    if (value[field] != null && !isNonEmptyString(value[field])) {
      pushError(errors, field, "deve ser string não vazia.");
    }
  }

  for (const field of ["rawBytes", "compressedBytes", "chunkSize"]) {
    if (value[field] != null && !isFiniteNumber(value[field])) {
      pushError(errors, field, "deve ser número finito.");
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateImageDataContract(value, options = {}) {
  const context = options.context ?? "runtimeRead";

  if (!VALID_CONTEXTS.has(context)) {
    throw new Error(`Unsupported imageData contract context: ${context}`);
  }

  if (!isRecord(value)) {
    return { ok: false, errors: ["imageData: deve ser um objeto."] };
  }

  if (context === "compressedMunicipalPatch") {
    return validateCompressedTerritorialEnvelope(value);
  }

  if (context === "runtimeRead" && isLegacyImageDataMap(value)) {
    return { ok: true, errors: [] };
  }

  const errors = [];

  if (context === "municipalPatch") {
    validateMunicipalPatch(value, errors);
  } else {
    validateCompactDataset(value, context, errors);
  }

  return { ok: errors.length === 0, errors };
}

export function assertValidImageDataContract(value, options = {}) {
  const validation = validateImageDataContract(value, options);

  if (!validation.ok) {
    const context = options.context ?? "runtimeRead";
    throw new Error(
      `Invalid imageData contract (${context}): ${validation.errors.join("; ")}`,
    );
  }

  return value;
}

export function isCompactTerritorialImageData(value) {
  return validateImageDataContract(value, { context: "runtimeRead" }).ok && !isLegacyImageDataMap(value);
}
