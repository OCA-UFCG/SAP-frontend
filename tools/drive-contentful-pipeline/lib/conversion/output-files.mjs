import {
  access,
  mkdir,
  open,
  readdir,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
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
import { writeMunicipalReportSeries } from "./municipal-report-series-writer.mjs";
import { toAvailabilityEntry } from "./availability-index.mjs";
import { readFile } from "node:fs/promises";
import { indentJson, sortRecordEntries } from "../shared/records.mjs";
import {
  resolveWorkspacePath,
  slugifyFileName,
  toWorkspaceRelativePath,
} from "../shared/paths.mjs";
import { readDriveCsvSnapshot } from "../drive/drive-snapshot.mjs";

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

class CsvSourceCollisionError extends Error {
  constructor(message) {
    super(message);
    this.name = "CsvSourceCollisionError";
    this.code = "CSV_SOURCE_COLLISION";
  }
}

function mergeCompatibleRecords(left, right, label, sourceCsvPath) {
  const merged = { ...left };

  for (const [key, value] of Object.entries(right)) {
    if (key in merged && !isDeepStrictEqual(merged[key], value)) {
      throw new Error(
        `${label}.${key} divergente ao agregar ${sourceCsvPath}.`,
      );
    }

    merged[key] = value;
  }

  return sortRecordEntries(merged);
}

function selectDominantTerritory(conversions) {
  if (conversions.some((conversion) => conversion.territory === "multilevel")) {
    return "multilevel";
  }

  return conversions[0]?.territory;
}

function getSourceMetadata(inputPath, sourceMetadata, yearKey) {
  const metadata = sourceMetadata.get(inputPath);

  if (!metadata?.modifiedTime || !Number.isFinite(metadata.modifiedAt)) {
    throw new CsvSourceCollisionError(
      `Colisão na referência ${yearKey}: o arquivo ${inputPath} não possui modifiedTime do Google Drive. Baixe novamente os CSVs para gerar o snapshot antes de usar --skip-download.`,
    );
  }

  return metadata;
}

function toCollisionDecision(yearKey, winner, loser, identical = false) {
  return {
    yearKey,
    winnerInputPath: winner.inputPath,
    winnerModifiedTime: winner.metadata.modifiedTime,
    loserInputPath: loser.inputPath,
    loserModifiedTime: loser.metadata.modifiedTime,
    identical,
  };
}

function mergeYearsByMostRecentlyModified(
  conversions,
  skipped,
  sourceMetadata,
) {
  const mergedYears = {};

  for (const conversion of conversions.sort((left, right) =>
    left.inputPath.localeCompare(right.inputPath),
  )) {
    for (const [yearKey, yearEntry] of Object.entries(
      conversion.imageData.years,
    )) {
      const candidate = {
        inputPath: conversion.inputPath,
        yearEntry,
      };
      const existing = mergedYears[yearKey];

      if (!existing) {
        mergedYears[yearKey] = candidate;
        continue;
      }

      candidate.metadata = getSourceMetadata(
        candidate.inputPath,
        sourceMetadata,
        yearKey,
      );
      existing.metadata = getSourceMetadata(
        existing.inputPath,
        sourceMetadata,
        yearKey,
      );
      const candidateModifiedAt = candidate.metadata.modifiedAt;
      const existingModifiedAt = existing.metadata.modifiedAt;
      const identical = isDeepStrictEqual(
        candidate.yearEntry,
        existing.yearEntry,
      );

      if (candidateModifiedAt === existingModifiedAt && !identical) {
        throw new CsvSourceCollisionError(
          `Colisão divergente na referência ${yearKey}: ${candidate.inputPath} e ${existing.inputPath} possuem o mesmo modifiedTime (${candidate.metadata.modifiedTime}).`,
        );
      }

      const candidateWins = candidateModifiedAt > existingModifiedAt;
      const winner = candidateWins ? candidate : existing;
      const loser = candidateWins ? existing : candidate;

      if (candidateWins) {
        mergedYears[yearKey] = candidate;
      }

      const collision = toCollisionDecision(yearKey, winner, loser, identical);
      skipped.push({
        inputPath: loser.inputPath,
        reason: identical
          ? `Referência ${yearKey} duplicada com conteúdo idêntico; mantida ${winner.inputPath} (${winner.metadata.modifiedTime}).`
          : `Referência ${yearKey} substituída por ${winner.inputPath}, modificado mais recentemente no Google Drive (${winner.metadata.modifiedTime} > ${loser.metadata.modifiedTime}).`,
        ignored: true,
        collision,
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

function mergeConversionEntries(convertedEntries, skipped, sourceMetadata) {
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
      templates: convertedEntries.reduce(
        (templates, { conversion }) =>
          mergeCompatibleRecords(
            templates,
            conversion.imageData.templates,
            "templates",
            conversion.inputPath,
          ),
        {},
      ),
      years: mergeYearsByMostRecentlyModified(
        convertedEntries.map(({ conversion }) => conversion),
        skipped,
        sourceMetadata,
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
  reportSeriesDir,
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
          fileState.baseTemplates = mergeCompatibleRecords(
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
      convertedEntries,
      skipped,
      options.sourceMetadata,
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

    const reportSeries =
      activeEntries[0]?.conversion && group.panelLayerId
        ? await writeMunicipalReportSeries(
            activeEntries[0].conversion,
            group,
            reportSeriesDir,
            pipelineConfig,
            { maxImageDataBytes: options.maxContentfulJsonBytes },
          )
        : null;

    await closeAggregateFile(fileState);

    return {
      conversions,
      availabilityEntries: activeEntries
        .map(({ conversion }) => toAvailabilityEntry(conversion))
        .filter(Boolean),
      skipped,
      partitionFiles,
      aggregatedFile: buildAggregatedFile(group, fileState, conversions),
      reportSeries,
    };
  } catch (error) {
    if (fileState.handle) await fileState.handle.close();
    throw error;
  }
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
  sourceMetadata,
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
      skipped.push({
        ...toSkippedCsv(toWorkspaceRelativePath(csvPath), error),
        panelLayerId: inferPanelLayerMapping(csvPath, pipelineConfig.layerRules)
          .panelLayerId,
      });
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
        years: mergeYearsByMostRecentlyModified(
          panelLayerConversions,
          skipped,
          sourceMetadata,
        ),
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

  const successfulPanelLayerIds = new Set(
    conversions.map((conversion) => conversion.panelLayerId),
  );
  const normalizedSkipped = skipped.map((item) =>
    item.panelLayerId &&
    successfulPanelLayerIds.has(item.panelLayerId) &&
    item.reason.includes("Configuração sem imageId")
      ? {
          ...item,
          reason: `${item.reason} Fonte canônica de panelLayer encontrada para ${item.panelLayerId}; arquivo estatístico alternativo ignorado.`,
          ignored: true,
        }
      : item,
  );

  return { files, conversions, skipped: normalizedSkipped };
}

function isMultilevelPanelLayerCsv(rows, csvPath, pipelineConfig) {
  const mapping = inferPanelLayerMapping(csvPath, pipelineConfig.layerRules);
  const panelLayerConfig = mapping.panelLayerId
    ? pipelineConfig.panelLayerProfiles[mapping.panelLayerId]
    : null;

  return (
    isMultilevelTerritoryRow(rows[0]) &&
    (panelLayerConfig?.mapVisualization?.sourceType === "image" ||
      panelLayerConfig?.allowMultilevelPanelLayer === true)
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

function matchesFileName(pattern, name) {
  pattern.lastIndex = 0;
  return pattern.test(name);
}

async function resolveCsvSources(csvDir, fileNamePattern) {
  const snapshot = await readDriveCsvSnapshot(csvDir);
  const sourceMetadata = new Map();

  if (snapshot) {
    const csvPaths = [];
    for (const file of snapshot.files) {
      if (
        !file.localName.toLowerCase().endsWith(".csv") ||
        !matchesFileName(fileNamePattern, file.localName)
      ) {
        continue;
      }

      const csvPath = path.join(csvDir, file.localName);
      try {
        await access(csvPath);
      } catch {
        throw new Error(
          `O arquivo ${file.localName}, registrado no snapshot do Drive, não existe em ${toWorkspaceRelativePath(csvDir)}.`,
        );
      }
      const relativePath = toWorkspaceRelativePath(csvPath);
      csvPaths.push(csvPath);
      sourceMetadata.set(relativePath, file);
    }

    return {
      csvPaths: csvPaths.sort((left, right) => left.localeCompare(right)),
      sourceMetadata,
      snapshot,
    };
  }

  const csvPaths = (await readdir(csvDir, { withFileTypes: true }))
    .filter(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"),
    )
    .filter((entry) => matchesFileName(fileNamePattern, entry.name))
    .map((entry) => path.join(csvDir, entry.name))
    .sort((left, right) => left.localeCompare(right));

  return { csvPaths, sourceMetadata, snapshot: null };
}

export async function convertCsvDirectory(options, pipelineConfig) {
  const csvDir = resolveWorkspacePath(options.csvDir);
  const jsonDir = resolveWorkspacePath(options.jsonDir);
  await mkdir(jsonDir, { recursive: true });

  const { csvPaths, sourceMetadata, snapshot } = await resolveCsvSources(
    csvDir,
    options.fileNamePattern,
  );

  if (csvPaths.length === 0) {
    throw new Error(
      `Nenhum CSV encontrado em ${toWorkspaceRelativePath(csvDir)}.`,
    );
  }

  await cleanGeneratedImageDataFiles(jsonDir);
  const partitionDir = await cleanGeneratedDirectory(jsonDir, "partitions");
  const panelLayerDir = await cleanGeneratedDirectory(jsonDir, "panel-layers");
  const reportSeriesDir = await cleanGeneratedDirectory(
    jsonDir,
    "report-series",
  );
  const classified = await classifyCsvPaths(csvPaths, pipelineConfig);
  const panelLayerResult = await writePanelLayerImageDataFiles(
    classified.panelLayerCsvPaths,
    panelLayerDir,
    pipelineConfig,
    sourceMetadata,
  );
  const result = {
    aggregatedFiles: [],
    conversions: [],
    availabilityEntries: [],
    panelLayerConversions: panelLayerResult.conversions,
    partitionFiles: [],
    panelLayerFiles: panelLayerResult.files,
    reportSeries: [],
    driveSnapshot: snapshot,
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
        { ...options, sourceMetadata },
        pipelineConfig,
        reportSeriesDir,
      );
      result.conversions.push(...groupResult.conversions);
      result.availabilityEntries.push(...groupResult.availabilityEntries);
      result.skipped.push(...groupResult.skipped);
      result.partitionFiles.push(...groupResult.partitionFiles);
      if (groupResult.aggregatedFile)
        result.aggregatedFiles.push(groupResult.aggregatedFile);
      if (groupResult.reportSeries)
        result.reportSeries.push(groupResult.reportSeries);
    } catch (error) {
      if (error?.code === "CSV_SOURCE_COLLISION") throw error;
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
