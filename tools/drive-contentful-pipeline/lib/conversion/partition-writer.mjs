import { gzipSync } from "node:zlib";
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { getCalendarYear } from "../csv/year.mjs";
import { slugifyFileName, toWorkspaceRelativePath } from "../shared/paths.mjs";

function encodeImageDataPayload(imageData, options, pipelineConfig) {
  if (options.writeRawPartitions) return imageData;

  const rawJson = JSON.stringify(imageData);
  const compressed = gzipSync(Buffer.from(rawJson, "utf8"), { level: 9 });
  const encoded = compressed.toString("base64");
  const chunks = [];
  const chunkSize = pipelineConfig.limits.compressedDataChunkSize;

  for (let index = 0; index < encoded.length; index += chunkSize) {
    chunks.push(encoded.slice(index, index + chunkSize));
  }

  return {
    schemaVersion: 1,
    type: "territorial-compact-compressed",
    encoding: "gzip+base64",
    mediaType: "application/vnd.sap.territorial-analysis+json",
    rawBytes: Buffer.byteLength(rawJson),
    compressedBytes: compressed.byteLength,
    chunkSize,
    data: chunks,
  };
}

function getPartitionOutputFileName(group, territory, partitionKey) {
  const baseName = group.panelLayerId
    ? `municipal-analysis.${slugifyFileName(group.panelLayerId)}`
    : `${slugifyFileName(group.sourceCsvPaths[0])}.unmapped`;

  return `${baseName}.${partitionKey}.${territory}.imageData.json`;
}

function buildPartitionPayload(conversion, years, options, pipelineConfig) {
  const imageData = { templates: conversion.imageData.templates, years };
  const outputPayload = encodeImageDataPayload(
    imageData,
    options,
    pipelineConfig,
  );

  return {
    outputPayload,
    rawBytes: Buffer.byteLength(JSON.stringify(imageData)),
    outputBytes: Buffer.byteLength(JSON.stringify(outputPayload)),
  };
}

async function writePartitionFile(params) {
  const {
    conversion,
    group,
    partitionDir,
    writtenPartitions,
    partitionKey,
    calendarYear,
    years,
    splitReason,
    options,
    pipelineConfig,
  } = params;
  const uniquePartitionKey = `${group.panelLayerId ?? group.sourceCsvPaths[0]}::${conversion.territory}::${partitionKey}`;
  const routePartitionKey = `${group.panelLayerId ?? group.sourceCsvPaths[0]}::${partitionKey}`;

  if (writtenPartitions.has(uniquePartitionKey)) {
    throw new Error(
      `Partição duplicada para ${uniquePartitionKey} ao processar ${conversion.inputPath}.`,
    );
  }

  writtenPartitions.add(uniquePartitionKey);

  if (writtenPartitions.has(routePartitionKey)) {
    throw new Error(
      `Partição ambígua para rota ${routePartitionKey} ao processar ${conversion.inputPath}. Use partitionKey exclusivo por panelLayerId.`,
    );
  }

  writtenPartitions.add(routePartitionKey);

  const payload = buildPartitionPayload(
    conversion,
    years,
    options,
    pipelineConfig,
  );

  if (payload.outputBytes > options.maxContentfulJsonBytes) {
    throw new Error(
      `Partição ${partitionKey} de ${conversion.inputPath} gerou ${payload.outputBytes} bytes, acima do limite ${options.maxContentfulJsonBytes}.`,
    );
  }

  const outputPath = path.join(
    partitionDir,
    getPartitionOutputFileName(group, conversion.territory, partitionKey),
  );
  await writeFile(
    outputPath,
    `${JSON.stringify(payload.outputPayload)}\n`,
    "utf8",
  );

  return {
    panelLayerId: group.panelLayerId,
    layerKey: group.layerKey,
    layerLabel: group.layerLabel,
    territory: conversion.territory,
    partitionKey,
    calendarYear,
    outputPath: toWorkspaceRelativePath(outputPath),
    sourceCsvPath: conversion.inputPath,
    locationCount: conversion.locationCount,
    yearKeys: Object.keys(years).sort(),
    encoding: payload.outputPayload.encoding ?? "identity",
    rawBytes: payload.rawBytes,
    outputBytes: payload.outputBytes,
    ...(splitReason ? { splitReason } : {}),
  };
}

export async function writeAnnualPartitions(
  conversion,
  group,
  partitionDir,
  writtenPartitions,
  options,
  pipelineConfig,
) {
  const yearsByCalendarYear = new Map();

  for (const [yearKey, yearEntry] of Object.entries(
    conversion.imageData.years,
  )) {
    const calendarYear = getCalendarYear(yearKey);
    yearsByCalendarYear.set(calendarYear, {
      ...(yearsByCalendarYear.get(calendarYear) ?? {}),
      [yearKey]: yearEntry,
    });
  }

  const partitionFiles = [];

  for (const [calendarYear, years] of yearsByCalendarYear) {
    const annualPayload = buildPartitionPayload(
      conversion,
      years,
      options,
      pipelineConfig,
    );

    if (annualPayload.outputBytes <= options.maxContentfulJsonBytes) {
      partitionFiles.push(
        await writePartitionFile({
          conversion,
          group,
          partitionDir,
          writtenPartitions,
          partitionKey: calendarYear,
          calendarYear,
          years,
          options,
          pipelineConfig,
        }),
      );
      continue;
    }

    for (const [yearKey, yearEntry] of Object.entries(years).sort()) {
      partitionFiles.push(
        await writePartitionFile({
          conversion,
          group,
          partitionDir,
          writtenPartitions,
          partitionKey: yearKey,
          calendarYear,
          years: { [yearKey]: yearEntry },
          splitReason: `annual partition exceeded ${options.maxContentfulJsonBytes} bytes`,
          options,
          pipelineConfig,
        }),
      );
    }
  }

  return partitionFiles;
}
