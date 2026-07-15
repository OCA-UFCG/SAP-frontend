export interface MunicipalAvailabilityLayer {
  panelLayerId: string;
  layerKey?: string;
  label?: string;
  category?: string;
  order: number;
  periods: string[];
}

export type MunicipalAvailabilityByMunicipality = Record<
  string,
  Record<string, string>
>;

export interface MunicipalAvailabilityIndex {
  schemaVersion: number;
  generatedAt: string;
  layers: MunicipalAvailabilityLayer[];
  byMunicipality: MunicipalAvailabilityByMunicipality;
  periodYears?: string[];
}

function getPeriodYear(period: string) {
  return period.match(/^(\d{4})(?:-\d{2})?$/u)?.[1] ?? null;
}

function periodMatchesRequest(availablePeriod: string, requestedPeriod: string) {
  if (availablePeriod === requestedPeriod) return true;
  if (!/^\d{4}$/u.test(requestedPeriod)) return false;

  return getPeriodYear(availablePeriod) === requestedPeriod;
}

function decodePeriodRange(value: string): number[] {
  if (!value) return [];

  return value.split(",").flatMap((part) => {
    const [start, end] = part.split("-").map(Number);

    if (!Number.isInteger(start)) return [];
    if (!Number.isInteger(end)) return [start];

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  });
}

function getLayerPeriods(
  index: MunicipalAvailabilityIndex,
  panelLayerId: string,
): string[] {
  return (
    index.layers.find((layer) => layer.panelLayerId === panelLayerId)
      ?.periods ?? []
  );
}

function getAvailableLayerPeriods(
  index: MunicipalAvailabilityIndex,
  municipalityCode: string,
  panelLayerId: string,
): string[] {
  const encodedPeriods = index.byMunicipality[municipalityCode]?.[panelLayerId];
  if (!encodedPeriods) return [];

  const layerPeriods = getLayerPeriods(index, panelLayerId);

  return decodePeriodRange(encodedPeriods).flatMap((periodIndex) => {
    const period = layerPeriods[periodIndex];
    return period ? [period] : [];
  });
}

export function resolveNearestReportPeriod(
  availablePeriods: readonly string[],
  requestedPeriod: string,
): string | null {
  const periods = [...new Set(availablePeriods)]
    .filter((period) => /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/u.test(period))
    .sort((left, right) => left.localeCompare(right));

  if (periods.includes(requestedPeriod)) return requestedPeriod;

  if (/^\d{4}$/u.test(requestedPeriod)) {
    const periodsInRequestedYear = periods.filter(
      (period) => getPeriodYear(period) === requestedPeriod,
    );
    if (periodsInRequestedYear.length > 0) {
      return periodsInRequestedYear.at(-1) ?? null;
    }
  }

  const previousPeriod = periods
    .filter((period) => period < requestedPeriod)
    .at(-1);
  if (previousPeriod) return previousPeriod;

  return periods.find((period) => period > requestedPeriod) ?? null;
}

export function resolveMunicipalLayerPeriod(
  index: MunicipalAvailabilityIndex,
  municipalityCode: string,
  panelLayerId: string,
  requestedPeriod: string,
): string | null {
  return resolveNearestReportPeriod(
    getAvailableLayerPeriods(index, municipalityCode, panelLayerId),
    requestedPeriod,
  );
}

export function getResolvableReportLayers(
  index: MunicipalAvailabilityIndex,
  municipalityCode: string,
  requestedPeriod: string,
): string[] {
  const layerAvailability = index.byMunicipality[municipalityCode] ?? {};

  return Object.keys(layerAvailability).filter(
    (panelLayerId) =>
      resolveMunicipalLayerPeriod(
        index,
        municipalityCode,
        panelLayerId,
        requestedPeriod,
      ) !== null,
  );
}

export function hasMunicipalLayerPeriod(
  index: MunicipalAvailabilityIndex,
  municipalityCode: string,
  panelLayerId: string,
  period: string,
): boolean {
  const periods = getAvailableLayerPeriods(index, municipalityCode, panelLayerId);

  return periods.some((availablePeriod) =>
    periodMatchesRequest(availablePeriod, period),
  );
}

export function getAvailableReportLayers(
  index: MunicipalAvailabilityIndex,
  municipalityCode: string,
  period: string,
): string[] {
  const layerAvailability = index.byMunicipality[municipalityCode] ?? {};

  return Object.entries(layerAvailability)
    .filter(([panelLayerId]) =>
      getAvailableLayerPeriods(index, municipalityCode, panelLayerId).some((availablePeriod) =>
        periodMatchesRequest(availablePeriod, period),
      ),
    )
    .map(([panelLayerId]) => panelLayerId);
}

export function getAvailablePeriods(
  index: MunicipalAvailabilityIndex,
  municipalityCode?: string,
): string[] {
  if (!municipalityCode) {
    return [
      ...new Set(
        index.layers.flatMap((layer) =>
          layer.periods.map((period) => getPeriodYear(period) ?? period),
        ),
      ),
    ].sort((left, right) => right.localeCompare(left));
  }

  const layerAvailability = index.byMunicipality[municipalityCode] ?? {};

  return [
    ...new Set(
      Object.keys(layerAvailability)
        .flatMap((panelLayerId) =>
          getAvailableLayerPeriods(index, municipalityCode, panelLayerId),
        )
        .map((period) => getPeriodYear(period) ?? period),
    ),
  ].sort((left, right) => right.localeCompare(left));
}
