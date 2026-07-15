export function buildMunicipalAnalysisManifest(
  aggregatedFiles,
  partitionFiles,
  pipelineConfig,
) {
  return {
    generatedAt: new Date().toISOString(),
    mappingRules: pipelineConfig.layerRules.map((rule) => ({
      key: rule.key,
      label: rule.label,
      panelLayerId: rule.panelLayerId,
      patterns: rule.patternSources,
    })),
    mapped: aggregatedFiles
      .filter((conversion) => conversion.panelLayerId)
      .map((conversion) => ({
        panelLayerId: conversion.panelLayerId,
        layerKey: conversion.layerKey,
        layerLabel: conversion.layerLabel,
        territory: conversion.territory,
        imageDataPath: conversion.outputPath,
        sourceCsvPaths: conversion.sourceCsvPaths,
        yearKeys: conversion.yearKeys,
        locationCount: conversion.locationCount,
      })),
    unmapped: aggregatedFiles
      .filter((conversion) => !conversion.panelLayerId)
      .map((conversion) => ({
        territory: conversion.territory,
        imageDataPath: conversion.outputPath,
        sourceCsvPaths: conversion.sourceCsvPaths,
        yearKeys: conversion.yearKeys,
        locationCount: conversion.locationCount,
      })),
    partitions: partitionFiles
      .filter((partition) => partition.panelLayerId)
      .map(toManifestPartition),
    unmappedPartitions: partitionFiles
      .filter((partition) => !partition.panelLayerId)
      .map(toManifestPartition),
  };
}

function toManifestPartition(partition) {
  return {
    ...(partition.panelLayerId ? { panelLayerId: partition.panelLayerId } : {}),
    ...(partition.layerKey ? { layerKey: partition.layerKey } : {}),
    ...(partition.layerLabel ? { layerLabel: partition.layerLabel } : {}),
    territory: partition.territory,
    partitionKey: partition.partitionKey,
    calendarYear: partition.calendarYear,
    imageDataPath: partition.outputPath,
    sourceCsvPath: partition.sourceCsvPath,
    yearKeys: partition.yearKeys,
    locationCount: partition.locationCount,
    encoding: partition.encoding,
    rawBytes: partition.rawBytes,
    outputBytes: partition.outputBytes,
    ...(partition.splitReason ? { splitReason: partition.splitReason } : {}),
  };
}

export function buildPanelLayerImageDataManifest(panelLayerFiles) {
  return {
    generatedAt: new Date().toISOString(),
    panelLayers: panelLayerFiles.map((file) => ({
      panelLayerId: file.panelLayerId,
      layerKey: file.layerKey,
      layerLabel: file.layerLabel,
      imageDataPath: file.outputPath,
      sourceCsvPath: file.sourceCsvPath,
      yearKeys: file.yearKeys,
      locationCount: file.locationCount,
      imageDataBytes: file.imageDataBytes,
    })),
  };
}

export function buildMunicipalReportSeriesManifest(reportSeries) {
  const keys = new Set();
  for (const layer of reportSeries) {
    for (const shard of layer.shards) {
      const key = `${layer.panelLayerId}::${layer.datasetVersion}::${shard.shardKey}`;
      if (keys.has(key)) throw new Error(`Shard municipalReportSeries duplicado: ${key}.`);
      keys.add(key);
    }
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    layers: reportSeries,
  };
}

export function buildPipelineValidation(
  conversions,
  partitionFiles,
  skipped,
  options,
) {
  const mappedConversions = conversions.filter(
    (conversion) => conversion.panelLayerId,
  );
  const partitionSourcePaths = new Set(
    partitionFiles.map((partition) => partition.sourceCsvPath),
  );
  const mappedSourcesWithoutPartitions = mappedConversions
    .filter((conversion) => !partitionSourcePaths.has(conversion.inputPath))
    .map((conversion) => conversion.inputPath);
  const oversizedPartitions = partitionFiles
    .filter(
      (partition) => partition.outputBytes > options.maxContentfulJsonBytes,
    )
    .map((partition) => ({
      imageDataPath: partition.outputPath,
      outputBytes: partition.outputBytes,
      maxContentfulJsonBytes: options.maxContentfulJsonBytes,
    }));
  const skippedCsvs = skipped
    .filter((item) => !item.ignored)
    .map((item) => ({ inputPath: item.inputPath, reason: item.reason }));
  const ignoredSkippedCsvs = skipped
    .filter((item) => item.ignored)
    .map((item) => ({ inputPath: item.inputPath, reason: item.reason }));

  return {
    ok:
      mappedSourcesWithoutPartitions.length === 0 &&
      oversizedPartitions.length === 0 &&
      skippedCsvs.length === 0,
    maxContentfulJsonBytes: options.maxContentfulJsonBytes,
    mappedSourcesWithoutPartitions,
    oversizedPartitions,
    skippedCsvs,
    ignoredSkippedCsvs,
  };
}

export function buildConversionReport(
  conversionResult,
  downloads,
  validation,
  options,
  manifests,
) {
  return {
    csvDir: options.csvDir,
    jsonDir: options.jsonDir,
    downloadedFiles: downloads.length,
    convertedFiles: conversionResult.conversions.length,
    convertedPanelLayerFiles: conversionResult.panelLayerConversions.length,
    skippedFiles: conversionResult.skipped.length,
    mappedSourceFiles: conversionResult.conversions.filter(
      (conversion) => conversion.panelLayerId,
    ).length,
    unmappedSourceFiles: conversionResult.conversions.filter(
      (conversion) => !conversion.panelLayerId,
    ).length,
    aggregatedFiles: conversionResult.aggregatedFiles.length,
    mappedAggregatedFiles: manifests.municipalAnalysisManifest.mapped.length,
    unmappedAggregatedFiles:
      manifests.municipalAnalysisManifest.unmapped.length,
    partitionFiles: conversionResult.partitionFiles.length,
    panelLayerFiles: conversionResult.panelLayerFiles.length,
    reportSeriesLayers: conversionResult.reportSeries.length,
    reportSeriesShards: conversionResult.reportSeries.reduce(
      (total, layer) => total + layer.shards.length,
      0,
    ),
    mappedPartitionFiles: manifests.municipalAnalysisManifest.partitions.length,
    unmappedPartitionFiles:
      manifests.municipalAnalysisManifest.unmappedPartitions.length,
    downloads,
    conversions: conversionResult.conversions,
    panelLayerConversions: conversionResult.panelLayerConversions,
    aggregatedFilesDetails: conversionResult.aggregatedFiles,
    partitionFilesDetails: conversionResult.partitionFiles,
    panelLayerFilesDetails: conversionResult.panelLayerFiles,
    skipped: conversionResult.skipped,
    validation,
  };
}
