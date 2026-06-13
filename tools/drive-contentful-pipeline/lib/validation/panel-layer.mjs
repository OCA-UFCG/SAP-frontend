import { isRecord } from "../shared/records.mjs";

export function validatePanelLayerImageData(imageData, context = "") {
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
