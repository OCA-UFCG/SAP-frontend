function isMunicipalityCode(value) {
  return /^\d{7}$/u.test(value);
}

function getPeriodYear(period) {
  return period.match(/^(\d{4})(?:-\d{2})?$/u)?.[1] ?? null;
}

function createLayerEntry(entry, order) {
  return {
    panelLayerId: entry.panelLayerId,
    ...(entry.layerKey ? { layerKey: entry.layerKey } : {}),
    ...(entry.layerLabel ? { label: entry.layerLabel } : {}),
    ...(entry.category ? { category: entry.category } : {}),
    order,
    periods: [],
  };
}

function encodeIndexesAsRanges(indexes) {
  const sortedIndexes = [...indexes].sort((left, right) => left - right);
  const ranges = [];

  for (let index = 0; index < sortedIndexes.length; index += 1) {
    const start = sortedIndexes[index];
    let end = start;

    while (sortedIndexes[index + 1] === end + 1) {
      index += 1;
      end = sortedIndexes[index];
    }

    ranges.push(start === end ? String(start) : `${start}-${end}`);
  }

  return ranges.join(",");
}

export function toAvailabilityEntry(conversion) {
  if (!conversion.panelLayerId) return null;

  const periods = {};

  for (const [period, yearEntry] of Object.entries(
    conversion.imageData?.years ?? {},
  )) {
    const municipalities = Object.keys(yearEntry.values ?? {}).filter(
      isMunicipalityCode,
    );

    if (municipalities.length > 0) {
      periods[period] = municipalities.sort();
    }
  }

  if (Object.keys(periods).length === 0) return null;

  return {
    panelLayerId: conversion.panelLayerId,
    layerKey: conversion.layerKey,
    layerLabel: conversion.layerLabel,
    territory: conversion.territory,
    periods,
  };
}

export function buildMunicipalAvailabilityIndex(
  availabilityEntries,
  panelLayerFiles = [],
) {
  const layers = new Map();
  const periodSetsByMunicipality = {};
  const panelLayerMetadata = new Map(
    panelLayerFiles.map((entry, index) => [
      entry.panelLayerId,
      {
        layerKey: entry.layerKey,
        label: entry.layerLabel,
        order: index,
      },
    ]),
  );

  for (const entry of availabilityEntries) {
    if (!entry?.panelLayerId) continue;

    const metadata = panelLayerMetadata.get(entry.panelLayerId);
    const layer =
      layers.get(entry.panelLayerId) ??
      createLayerEntry(
        {
          ...entry,
          layerKey: metadata?.layerKey ?? entry.layerKey,
          layerLabel: metadata?.label ?? entry.layerLabel,
        },
        metadata?.order ?? layers.size,
      );

    const layerPeriods = new Set(layer.periods);

    for (const [period, municipalities] of Object.entries(entry.periods ?? {})) {
      layerPeriods.add(period);

      for (const municipalityCode of municipalities) {
        if (!isMunicipalityCode(municipalityCode)) continue;

        periodSetsByMunicipality[municipalityCode] ??= {};
        periodSetsByMunicipality[municipalityCode][entry.panelLayerId] ??=
          new Set();
        periodSetsByMunicipality[municipalityCode][entry.panelLayerId].add(
          period,
        );
      }
    }

    layer.periods = [...layerPeriods].sort();
    layers.set(entry.panelLayerId, layer);
  }

  const periodIndexesByLayer = new Map(
    [...layers.values()].map((layer) => [
      layer.panelLayerId,
      new Map(layer.periods.map((period, index) => [period, index])),
    ]),
  );
  const byMunicipality = Object.fromEntries(
    Object.entries(periodSetsByMunicipality)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([municipalityCode, layerPeriods]) => [
        municipalityCode,
        Object.fromEntries(
          Object.entries(layerPeriods)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([panelLayerId, periods]) => {
              const periodIndexes = periodIndexesByLayer.get(panelLayerId);
              const indexes = [...periods]
                .map((period) => periodIndexes?.get(period))
                .filter((index) => typeof index === "number");

              return [panelLayerId, encodeIndexesAsRanges(indexes)];
            }),
        ),
      ]),
  );

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    layers: [...layers.values()].sort(
      (left, right) =>
        left.order - right.order ||
        left.panelLayerId.localeCompare(right.panelLayerId),
    ),
    byMunicipality,
    periodYears: [
      ...new Set(
        [...layers.values()]
          .flatMap((layer) => layer.periods)
          .map(getPeriodYear)
          .filter(Boolean),
      ),
    ].sort((left, right) => right.localeCompare(left)),
  };
}
