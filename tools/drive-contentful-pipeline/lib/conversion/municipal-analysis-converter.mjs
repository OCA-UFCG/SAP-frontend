import { readFile } from "node:fs/promises";
import { toRows } from "../csv/csv-parser.mjs";
import { getClassColumns, getClassValues } from "../csv/class-columns.mjs";
import { inferPanelLayerMapping } from "../csv/layer-mapping.mjs";
import { getLocation, inferTerritory } from "../csv/territory.mjs";
import { getYearKey } from "../csv/year.mjs";
import { sortRecordEntries } from "../shared/records.mjs";
import { toWorkspaceRelativePath } from "../shared/paths.mjs";

function getTemplates(territory, mapping, pipelineConfig) {
  const panelLayerConfig = mapping.panelLayerId
    ? pipelineConfig.panelLayerProfiles[mapping.panelLayerId]
    : null;

  if (panelLayerConfig?.templates) {
    return panelLayerConfig.templates;
  }

  if (territory === "municipality") {
    return { municipality: pipelineConfig.defaults.municipalityTemplate };
  }

  return { state: pipelineConfig.defaults.stateTemplate };
}

function toMunicipalAnalysisImageData(
  years,
  territory,
  mapping,
  pipelineConfig,
) {
  const panelLayerConfig = mapping.panelLayerId
    ? pipelineConfig.panelLayerProfiles[mapping.panelLayerId]
    : null;
  const filteredYears = Array.from(years.entries()).filter(
    ([, yearEntry]) =>
      !panelLayerConfig?.omitAllZeroYears ||
      Object.values(yearEntry.values).some((values) =>
        values.some((value) => value !== 0),
      ),
  );

  return {
    templates: getTemplates(territory, mapping, pipelineConfig),
    years: Object.fromEntries(
      filteredYears
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([yearKey, yearEntry]) => [
          yearKey,
          {
            valuesScale: yearEntry.valuesScale,
            values: sortRecordEntries(yearEntry.values),
          },
        ]),
    ),
  };
}

export async function convertMunicipalAnalysisCsvFile(
  inputPath,
  pipelineConfig,
) {
  const rows = toRows(await readFile(inputPath, "utf8"));
  const territory = inferTerritory(rows[0]);
  const classColumns = getClassColumns(rows);
  const mapping = inferPanelLayerMapping(inputPath, pipelineConfig.layerRules);
  const locations = new Map();
  const years = new Map();

  for (const row of rows) {
    const location = getLocation(row, territory);
    const yearKey = getYearKey(row);
    const values = getClassValues(row, classColumns, location.key, yearKey);

    locations.set(location.key, location.label);

    if (!years.has(yearKey)) {
      years.set(yearKey, { valuesScale: 1, values: {} });
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
    territory,
    ...mapping,
    imageData: toMunicipalAnalysisImageData(
      years,
      territory,
      mapping,
      pipelineConfig,
    ),
    locationCount: locations.size,
    yearKeys: Object.keys(
      toMunicipalAnalysisImageData(years, territory, mapping, pipelineConfig)
        .years,
    ).sort(),
    classColumns: classColumns.columns,
  };
}
