import { readFile } from "node:fs/promises";
import { toRows } from "../csv/csv-parser.mjs";
import { getClassColumns, getClassValues } from "../csv/class-columns.mjs";
import { inferPanelLayerMapping } from "../csv/layer-mapping.mjs";
import {
  getMultilevelPanelLayerLocation,
  getPanelLayerLocation,
  isMultilevelTerritoryRow,
} from "../csv/territory.mjs";
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

function getForecastImageIdFromFileName(inputPath, yearKey, yearKeys) {
  const calibrationMatch = inputPath.match(/Cal_(\d{8})/iu);

  if (!calibrationMatch?.[1]) return "";

  const sortedYearKeys = Array.from(yearKeys).sort();
  const yearIndex = sortedYearKeys.indexOf(yearKey);

  if (yearIndex < 0) return "";

  const suffix = String(yearIndex + 1).padStart(2, "0");

  return `projects/ee-ulissesalencar17/assets/previsao_P_cal_${calibrationMatch[1]}_${suffix}`;
}

function getPanelLayerImageId(
  panelLayerConfig,
  yearKey,
  row,
  inputPath,
  yearKeys,
) {
  const inferredImageId = getForecastImageIdFromFileName(
    inputPath,
    yearKey,
    yearKeys,
  );
  const configuredImageId = panelLayerConfig.imageIdByYear?.[yearKey];
  const fallbackImageId = isMultilevelTerritoryRow(row)
    ? inferredImageId || configuredImageId
    : configuredImageId || inferredImageId;
  const imageId =
    String(row.image_id ?? row.imageId ?? row.IMAGE_ID ?? "").trim() ||
    fallbackImageId ||
    panelLayerConfig.imageId;

  if (!imageId) {
    throw new Error(
      `Configuração sem imageId para referência ${yearKey}. Informe image_id no CSV de panelLayer ou imageId/imageIdByYear na configuração.`,
    );
  }

  return imageId;
}

function toPanelLayerImageData(years, locations, panelLayerConfig) {
  const yearKeys = Array.from(years.keys())
    .filter((yearKey) => {
      if (!panelLayerConfig.omitAllZeroYears) return true;

      return Object.values(years.get(yearKey).values).some((values) =>
        values.some((value) => value !== 0),
      );
    })
    .sort();

  return {
    schemaVersion: 1,
    type: "territorial-compact",
    defaultYear: yearKeys[yearKeys.length - 1],
    classes: panelLayerConfig.classes,
    locations: sortRecordEntries(Object.fromEntries(locations)),
    templates: panelLayerConfig.templates,
    ranking: panelLayerConfig.ranking,
    valueConfig: panelLayerConfig.valueConfig,
    mapVisualization: panelLayerConfig.mapVisualization,
    years: Object.fromEntries(
      yearKeys.map((yearKey) => {
        const yearEntry = years.get(yearKey);

        return [
          yearKey,
          {
            imageId: yearEntry.imageId,
            year: yearEntry.year,
            valuesScale: yearEntry.valuesScale,
            values: sortRecordEntries(yearEntry.values),
          },
        ];
      }),
    ),
  };
}

function getPanelLayerCsvLocation(row) {
  if (isMultilevelTerritoryRow(row)) {
    return getMultilevelPanelLayerLocation(row);
  }

  return getPanelLayerLocation(row);
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
  const usesMultilevelContract = isMultilevelTerritoryRow(rows[0]);

  if (classColumns.type !== "value" && !usesMultilevelContract) {
    throw new Error(
      "CSV de panelLayer deve usar valor_classe_N para valores absolutos.",
    );
  }

  const locations = new Map();
  const years = new Map();
  const yearKeys = new Set(rows.map(getYearKey));

  for (const row of rows) {
    const location = getPanelLayerCsvLocation(row);

    if (!location) continue;

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
        imageId: getPanelLayerImageId(
          panelLayerConfig,
          yearKey,
          row,
          inputPath,
          yearKeys,
        ),
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

  const imageData = toPanelLayerImageData(years, locations, panelLayerConfig);

  return {
    inputPath: toWorkspaceRelativePath(inputPath),
    ...mapping,
    imageData,
    locationCount: locations.size,
    yearKeys: Object.keys(imageData.years).sort(),
    classColumns: classColumns.columns,
  };
}
