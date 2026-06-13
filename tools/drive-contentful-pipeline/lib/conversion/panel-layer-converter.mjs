import { readFile } from "node:fs/promises";
import { toRows } from "../csv/csv-parser.mjs";
import { getClassColumns, getClassValues } from "../csv/class-columns.mjs";
import { inferPanelLayerMapping } from "../csv/layer-mapping.mjs";
import { getPanelLayerLocation } from "../csv/territory.mjs";
import { getYearKey } from "../csv/year.mjs";
import { sortRecordEntries } from "../shared/records.mjs";
import { toWorkspaceRelativePath } from "../shared/paths.mjs";

function assertPanelLayerValuesInRange(values, panelLayerConfig, context) {
  const range = panelLayerConfig.valueRange;

  if (!range) return;

  values.forEach((value, index) => {
    if (typeof range.min === "number" && value < range.min) {
      throw new Error(
        `${context}/valor_classe_${index + 1}: valor ${value} abaixo do mínimo ${range.min}.`,
      );
    }

    if (typeof range.max === "number" && value > range.max) {
      throw new Error(
        `${context}/valor_classe_${index + 1}: valor ${value} acima do máximo ${range.max}.`,
      );
    }
  });
}

function getPanelLayerImageId(panelLayerConfig, yearKey, row) {
  const imageId =
    String(row.image_id ?? row.imageId ?? row.IMAGE_ID ?? "").trim() ||
    panelLayerConfig.imageIdByYear?.[yearKey] ||
    panelLayerConfig.imageId;

  if (!imageId) {
    throw new Error(
      `Configuração sem imageId para referência ${yearKey}. Informe image_id no CSV de panelLayer ou imageId/imageIdByYear na configuração.`,
    );
  }

  return imageId;
}

function toPanelLayerImageData(years, locations, panelLayerConfig) {
  const yearKeys = Array.from(years.keys()).sort();

  return {
    schemaVersion: 1,
    type: "territorial-compact",
    defaultYear: yearKeys[yearKeys.length - 1],
    classes: panelLayerConfig.classes,
    locations: sortRecordEntries(Object.fromEntries(locations)),
    templates: panelLayerConfig.templates,
    ranking: panelLayerConfig.ranking,
    mapVisualization: panelLayerConfig.mapVisualization,
    years: Object.fromEntries(
      Array.from(years.entries())
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([yearKey, yearEntry]) => [
          yearKey,
          {
            imageId: yearEntry.imageId,
            year: yearEntry.year,
            valuesScale: yearEntry.valuesScale,
            values: sortRecordEntries(yearEntry.values),
          },
        ]),
    ),
  };
}

export async function convertPanelLayerCsvFile(inputPath, pipelineConfig) {
  const rows = toRows(await readFile(inputPath, "utf8"));
  const mapping = inferPanelLayerMapping(inputPath, pipelineConfig.layerRules);

  if (!mapping.panelLayerId) {
    throw new Error(
      `CSV de panelLayer sem mapeamento de panelLayerId: ${inputPath}`,
    );
  }

  const panelLayerConfig =
    pipelineConfig.panelLayerProfiles[mapping.panelLayerId];

  if (!panelLayerConfig) {
    throw new Error(
      `CSV de panelLayer sem configuração para panelLayerId=${mapping.panelLayerId}.`,
    );
  }

  const classColumns = getClassColumns(rows);

  if (classColumns.type !== "value") {
    throw new Error(
      "CSV de panelLayer deve usar valor_classe_N para valores absolutos.",
    );
  }

  const locations = new Map();
  const years = new Map();

  for (const row of rows) {
    const location = getPanelLayerLocation(row);
    const yearKey = getYearKey(row);
    const values = getClassValues(row, classColumns, location.key, yearKey);
    assertPanelLayerValuesInRange(
      values,
      panelLayerConfig,
      `${location.key}/${yearKey}`,
    );
    locations.set(location.key, location.label);

    if (!years.has(yearKey)) {
      years.set(yearKey, {
        imageId: getPanelLayerImageId(panelLayerConfig, yearKey, row),
        year: yearKey,
        valuesScale: 1,
        values: {},
      });
    }

    const yearEntry = years.get(yearKey);

    if (yearEntry.values[location.key]) {
      throw new Error(
        `Duplicidade detectada para localidade ${location.key} na referência ${yearKey}.`,
      );
    }

    yearEntry.values[location.key] = values;
  }

  return {
    inputPath: toWorkspaceRelativePath(inputPath),
    ...mapping,
    imageData: toPanelLayerImageData(years, locations, panelLayerConfig),
    locationCount: locations.size,
    yearKeys: Array.from(years.keys()).sort(),
    classColumns: classColumns.columns,
  };
}
