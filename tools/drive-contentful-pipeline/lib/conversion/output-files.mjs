import { mkdir, open, readdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { toRows } from "../csv/csv-parser.mjs";
import {
  inferPanelLayerMapping,
  isPanelLayerCsv,
} from "../csv/layer-mapping.mjs";
import { groupCsvPaths } from "../csv/layer-mapping.mjs";
import { isMultilevelTerritoryRow } from "../csv/territory.mjs";
import { convertMunicipalAnalysisCsvFile } from "./municipal-analysis-converter.mjs";
import { convertPanelLayerCsvFile } from "./panel-layer-converter.mjs";
import { writeAnnualPartitions } from "./partition-writer.mjs";
import { readFile } from "node:fs/promises";
import { indentJson, sortRecordEntries } from "../shared/records.mjs";
import {
  resolveWorkspacePath,
  slugifyFileName,
  toWorkspaceRelativePath,
} from "../shared/paths.mjs";

async function cleanGeneratedImageDataFiles(jsonDir) {
  const entries = await readdir(jsonDir, { withFileTypes: true }).catch(
    (error) => {
      if (error?.code === "ENOENT") return [];
      throw error;
    },
  );

  await Promise.all(
    entries
      .filter(
        (entry) => entry.isFile() && entry.name.endsWith(".imageData.json"),
      )
      .map((entry) => unlink(path.join(jsonDir, entry.name))),
  );
}

async function cleanGeneratedDirectory(jsonDir, childDir) {
  const outputDir = path.join(jsonDir, childDir);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  return outputDir;
}

function getAggregatedOutputFileName(group) {
  if (!group.panelLayerId) {
    return `${slugifyFileName(group.sourceCsvPaths[0])}.unmapped.${group.territory}.imageData.json`;
  }

  return `municipal-analysis.${slugifyFileName(group.panelLayerId)}.${group.territory}.imageData.json`;
}

function getPanelLayerOutputFileName(conversion) {
  return `panel-layer.${slugifyFileName(conversion.panelLayerId)}.imageData.json`;
}

function toReportConversion(conversion) {
  const reportConversion = { ...conversion };
  delete reportConversion.imageData;

  return reportConversion;
}

function isSubsetOf(left, right) {
  return left.every((item) => right.includes(item));
}

function getSourceRank(inputPath) {
  const calibrationMatch = inputPath.match(/Cal_(\d{8})/iu);

  return calibrationMatch?.[1] ? Number(calibrationMatch[1]) : 0;
}

function shouldReplaceYearEntry(candidate, existing) {
  const candidateLocations = Object.keys(candidate.yearEntry.values).length;
  const existingLocations = Object.keys(existing.yearEntry.values).length;

  return (
    candidateLocations > existingLocations ||
    (candidateLocations === existingLocations &&
      candidate.sourceRank > existing.sourceRank)
  );
}

function isSupersededConversion(conversion, conversions) {
  const yearKeys = Object.keys(conversion.imageData.years).sort();

  return conversions.some((candidate) => {
    if (
      candidate === conversion ||
      candidate.territory !== conversion.territory
    )
      return false;
    const candidateYearKeys = Object.keys(candidate.imageData.years).sort();

    return (
      candidateYearKeys.length > yearKeys.length &&
      isSubsetOf(yearKeys, candidateYearKeys)
    );
  });
}

function assertSameRecord(left, right, label, sourceCsvPath) {
  const leftJson = JSON.stringify(sortRecordEntries(left));
  const rightJson = JSON.stringify(sortRecordEntries(right));

  if (leftJson !== rightJson) {
    throw new Error(`${label} divergente ao agregar ${sourceCsvPath}.`);
  }
}

function selectDominantTerritory(conversions) {
  if (conversions.some((conversion) => conversion.territory === "multilevel")) {
    return "multilevel";
  }

  return conversions[0]?.territory;
}

function mergeYearsByBestSource(conversions, skipped) {
  const mergedYears = {};

  for (const conversion of conversions.sort((left, right) =>
    left.inputPath.localeCompare(right.inputPath),
  )) {
    for (const [yearKey, yearEntry] of Object.entries(
      conversion.imageData.years,
    )) {
      const candidate = {
        inputPath: conversion.inputPath,
        sourceRank: getSourceRank(conversion.inputPath),
        yearEntry,
      };
      const existing = mergedYears[yearKey];

      if (!existing) {
        mergedYears[yearKey] = candidate;
        continue;
      }

      if (shouldReplaceYearEntry(candidate, existing)) {
        mergedYears[yearKey] = candidate;
      }

      skipped.push({
        inputPath: conversion.inputPath,
        reason: `Referência ${yearKey} substituída por CSV da mesma camada com mais localidades ou calibração mais recente.`,
        ignored: true,
      });
    }
  }

  return Object.fromEntries(
    Object.entries(mergedYears).map(([yearKey, entry]) => [
      yearKey,
      entry.yearEntry,
    ]),
  );
}

function mergeConversionEntries(convertedEntries, skipped) {
  if (convertedEntries.length <= 1) return convertedEntries;

  const dominantTerritory = selectDominantTerritory(
    convertedEntries.map(({ conversion }) => conversion),
  );
  const baseEntry =
    convertedEntries.find(
      ({ conversion }) => conversion.territory === dominantTerritory,
    ) ?? convertedEntries[0];
  const mergedConversion = {
    ...baseEntry.conversion,
    inputPath: convertedEntries
      .map(({ conversion }) => conversion.inputPath)
      .join(", "),
    territory: dominantTerritory,
    locationCount: Math.max(
      ...convertedEntries.map(({ conversion }) => conversion.locationCount),
    ),
    yearKeys: [],
    classColumns: Array.from(
      new Set(
        convertedEntries.flatMap(({ conversion }) => conversion.classColumns),
      ),
    ),
    imageData: {
      templates: baseEntry.conversion.imageData.templates,
      years: mergeYearsByBestSource(
        convertedEntries.map(({ conversion }) => conversion),
        skipped,
      ),
    },
  };

  mergedConversion.yearKeys = Object.keys(
    mergedConversion.imageData.years,
  ).sort();

  return [{ conversion: mergedConversion, csvPath: baseEntry.csvPath }];
}

async function maybeWriteAggregate(fileState, group, jsonDir, conversion) {
  if (!fileState.enabled) return;

  if (!fileState.handle) {
    fileState.outputPath = path.join(
      jsonDir,
      getAggregatedOutputFileName({ ...group, territory: fileState.territory }),
    );
    fileState.handle = await open(fileState.outputPath, "w");
    await fileState.handle.write("{\n");
    await fileState.handle.write(
      `  "templates": ${indentJson(JSON.stringify(fileState.baseTemplates, null, 2), 2)},\n`,
    );
    await fileState.handle.write('  "years": {\n');
  }

  for (const [yearKey, yearEntry] of Object.entries(
    conversion.imageData.years,
  )) {
    if (fileState.yearKeys.has(yearKey)) {
      throw new Error(
        `Ano/referência duplicado ao agregar ${conversion.inputPath}: ${yearKey}`,
      );
    }

    fileState.yearKeys.add(yearKey);
    await fileState.handle.write(
      `${fileState.hasYear ? ",\n" : ""}    ${JSON.stringify(yearKey)}: ${indentJson(JSON.stringify(yearEntry, null, 2), 4)}`,
    );
    fileState.hasYear = true;
  }
}

async function closeAggregateFile(fileState) {
  if (!fileState.handle) return;

  await fileState.handle.write("\n  }\n}\n");
  await fileState.handle.close();
  fileState.handle = null;
}

async function writeAggregatedGroup(
  group,
  jsonDir,
  partitionDir,
  options,
  pipelineConfig,
) {
  const skipped = [];
  const partitionFiles = [];
  const writtenPartitions = new Set();
  const convertedEntries = [];
  const fileState = {
    enabled: options.writeAggregates,
    handle: null,
    yearKeys: new Set(),
    hasYear: false,
  };

  try {
    for (const csvPath of group.sourceCsvPaths.sort((left, right) =>
      left.localeCompare(right),
    )) {
      try {
        const conversion = await convertMunicipalAnalysisCsvFile(
          csvPath,
          pipelineConfig,
        );
        const sortedTemplates = sortRecordEntries(
          conversion.imageData.templates,
        );

        if (!fileState.territory) {
          fileState.territory = conversion.territory;
          fileState.baseTemplates = sortedTemplates;
        } else if (
          conversion.territory !== fileState.territory &&
          ![conversion.territory, fileState.territory].includes("multilevel")
        ) {
          throw new Error(
            `Território divergente ao agregar ${conversion.inputPath}: ${conversion.territory} / ${fileState.territory}`,
          );
        } else {
          assertSameRecord(
            fileState.baseTemplates,
            sortedTemplates,
            "templates",
            conversion.inputPath,
          );
        }

        convertedEntries.push({ conversion, csvPath });
      } catch (error) {
        skipped.push(toSkippedCsv(toWorkspaceRelativePath(csvPath), error));
      }
    }

    const activeEntries = mergeConversionEntries(
      filterSupersededEntries(convertedEntries, skipped),
      skipped,
    );
    const conversions = activeEntries.map(({ conversion }) =>
      toReportConversion(conversion),
    );

    for (const { conversion } of activeEntries) {
      await maybeWriteAggregate(fileState, group, jsonDir, conversion);
      partitionFiles.push(
        ...(await writeAnnualPartitions(
          conversion,
          group,
          partitionDir,
          writtenPartitions,
          options,
          pipelineConfig,
        )),
      );
    }

    await closeAggregateFile(fileState);

    return {
      conversions,
      skipped,
      partitionFiles,
      aggregatedFile: buildAggregatedFile(group, fileState, conversions),
    };
  } catch (error) {
    if (fileState.handle) await fileState.handle.close();
    throw error;
  }
}

function filterSupersededEntries(convertedEntries, skipped) {
  const conversions = convertedEntries.map((entry) => entry.conversion);

  return convertedEntries.filter(({ conversion }) => {
    if (!isSupersededConversion(conversion, conversions)) return true;

    skipped.push({
      inputPath: conversion.inputPath,
      reason:
        "CSV substituído por outro arquivo da mesma camada/território com cobertura temporal mais completa.",
      ignored: true,
    });
    return false;
  });
}

function buildAggregatedFile(group, fileState, conversions) {
  if (!fileState.outputPath) return null;

  return {
    panelLayerId: group.panelLayerId,
    layerKey: group.layerKey,
    layerLabel: group.layerLabel,
    territory: fileState.territory,
    outputPath: toWorkspaceRelativePath(fileState.outputPath),
    sourceCsvPaths: conversions.map((conversion) => conversion.inputPath),
    classColumnsBySource: conversions.map((conversion) => ({
      sourceCsvPath: conversion.inputPath,
      classColumns: conversion.classColumns,
    })),
    locationCount: conversions[0]?.locationCount ?? 0,
    yearKeys: Array.from(fileState.yearKeys).sort(),
  };
}

function isIgnorableCsvError(inputPath, reason) {
  return (
    /^Estatisticas_RDs_/iu.test(path.basename(inputPath)) &&
    reason.includes("CSV sem colunas territoriais reconhecidas")
  );
}

export function toSkippedCsv(inputPath, error) {
  const reason = error instanceof Error ? error.message : String(error);

  return {
    inputPath,
    reason,
    ...(isIgnorableCsvError(inputPath, reason) ? { ignored: true } : {}),
  };
}

async function writePanelLayerImageDataFile(conversion, panelLayerDir) {
  const outputPath = path.join(
    panelLayerDir,
    getPanelLayerOutputFileName(conversion),
  );
  const json = JSON.stringify(conversion.imageData);
  await writeFile(outputPath, `${json}\n`, "utf8");

  return {
    panelLayerId: conversion.panelLayerId,
    layerKey: conversion.layerKey,
    layerLabel: conversion.layerLabel,
    outputPath: toWorkspaceRelativePath(outputPath),
    sourceCsvPath: conversion.inputPath,
    locationCount: conversion.locationCount,
    yearKeys: conversion.yearKeys,
    classColumns: conversion.classColumns,
    imageDataBytes: Buffer.byteLength(json),
  };
}

async function writePanelLayerImageDataFiles(
  csvPaths,
  panelLayerDir,
  pipelineConfig,
) {
  const files = [];
  const conversionsByPanelLayerId = new Map();
  const skipped = [];

  for (const csvPath of csvPaths) {
    try {
      const conversion = await convertPanelLayerCsvFile(
        csvPath,
        pipelineConfig,
      );
      if (!conversionsByPanelLayerId.has(conversion.panelLayerId)) {
        conversionsByPanelLayerId.set(conversion.panelLayerId, []);
      }

      conversionsByPanelLayerId.get(conversion.panelLayerId).push(conversion);
    } catch (error) {
      skipped.push(toSkippedCsv(toWorkspaceRelativePath(csvPath), error));
    }
  }

  const conversions = [];

  for (const panelLayerConversions of conversionsByPanelLayerId.values()) {
    const [baseConversion] = panelLayerConversions;
    const mergedConversion = {
      ...baseConversion,
      inputPath: panelLayerConversions
        .map((conversion) => conversion.inputPath)
        .join(", "),
      locationCount: Math.max(
        ...panelLayerConversions.map((conversion) => conversion.locationCount),
      ),
      yearKeys: [],
      classColumns: Array.from(
        new Set(
          panelLayerConversions.flatMap(
            (conversion) => conversion.classColumns,
          ),
        ),
      ),
      imageData: {
        ...baseConversion.imageData,
        years: mergeYearsByBestSource(panelLayerConversions, skipped),
      },
    };
    mergedConversion.yearKeys = Object.keys(
      mergedConversion.imageData.years,
    ).sort();
    mergedConversion.imageData.defaultYear =
      mergedConversion.yearKeys[mergedConversion.yearKeys.length - 1];

    conversions.push(toReportConversion(mergedConversion));
    files.push(
      await writePanelLayerImageDataFile(mergedConversion, panelLayerDir),
    );
  }

  return { files, conversions, skipped };
}

function isMultilevelPanelLayerCsv(rows, csvPath, pipelineConfig) {
  const mapping = inferPanelLayerMapping(csvPath, pipelineConfig.layerRules);
  const panelLayerConfig = mapping.panelLayerId
    ? pipelineConfig.panelLayerProfiles[mapping.panelLayerId]
    : null;

  return (
    isMultilevelTerritoryRow(rows[0]) &&
    panelLayerConfig?.mapVisualization?.sourceType === "image"
  );
}

async function classifyCsvPaths(csvPaths, pipelineConfig) {
  const panelLayerCsvPaths = [];
  const municipalAnalysisCsvPaths = [];
  const skipped = [];

  for (const csvPath of csvPaths) {
    try {
      const rows = toRows(await readFile(csvPath, "utf8"));
      if (isPanelLayerCsv(rows)) {
        panelLayerCsvPaths.push(csvPath);
      } else {
        municipalAnalysisCsvPaths.push(csvPath);

        if (isMultilevelPanelLayerCsv(rows, csvPath, pipelineConfig)) {
          panelLayerCsvPaths.push(csvPath);
        }
      }
    } catch (error) {
      skipped.push(toSkippedCsv(toWorkspaceRelativePath(csvPath), error));
    }
  }

  return { panelLayerCsvPaths, municipalAnalysisCsvPaths, skipped };
}

export async function convertCsvDirectory(options, pipelineConfig) {
  const csvDir = resolveWorkspacePath(options.csvDir);
  const jsonDir = resolveWorkspacePath(options.jsonDir);
  await mkdir(jsonDir, { recursive: true });

  const csvPaths = (await readdir(csvDir, { withFileTypes: true }))
    .filter(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"),
    )
    .filter((entry) => options.fileNamePattern.test(entry.name))
    .map((entry) => path.join(csvDir, entry.name))
    .sort((left, right) => left.localeCompare(right));

  if (csvPaths.length === 0) {
    throw new Error(
      `Nenhum CSV encontrado em ${toWorkspaceRelativePath(csvDir)}.`,
    );
  }

  await cleanGeneratedImageDataFiles(jsonDir);
  const partitionDir = await cleanGeneratedDirectory(jsonDir, "partitions");
  const panelLayerDir = await cleanGeneratedDirectory(jsonDir, "panel-layers");
  const classified = await classifyCsvPaths(csvPaths, pipelineConfig);
  const panelLayerResult = await writePanelLayerImageDataFiles(
    classified.panelLayerCsvPaths,
    panelLayerDir,
    pipelineConfig,
  );
  const result = {
    aggregatedFiles: [],
    conversions: [],
    panelLayerConversions: panelLayerResult.conversions,
    partitionFiles: [],
    panelLayerFiles: panelLayerResult.files,
    skipped: [...classified.skipped, ...panelLayerResult.skipped],
  };

  for (const group of groupCsvPaths(
    classified.municipalAnalysisCsvPaths,
    pipelineConfig.layerRules,
  )) {
    try {
      const groupResult = await writeAggregatedGroup(
        group,
        jsonDir,
        partitionDir,
        options,
        pipelineConfig,
      );
      result.conversions.push(...groupResult.conversions);
      result.skipped.push(...groupResult.skipped);
      result.partitionFiles.push(...groupResult.partitionFiles);
      if (groupResult.aggregatedFile)
        result.aggregatedFiles.push(groupResult.aggregatedFile);
    } catch (error) {
      result.skipped.push(
        toSkippedCsv(
          group.sourceCsvPaths.map(toWorkspaceRelativePath).join(", "),
          error,
        ),
      );
    }
  }

  return result;
}
