import type { MunicipalReportClass, MunicipalReportPeriodSnapshot } from "@/contracts/municipalReport";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";

export function roundReportPercentage(value: number): number {
  return Number(value.toFixed(1));
}

export function buildMunicipalReportSnapshot(
  dataset: CompactTerritorialAnalysisDataset,
  municipalityCode: string,
  period: string,
): MunicipalReportPeriodSnapshot | null {
  const year = dataset.years[period];
  const values = year?.values[municipalityCode];
  if (!year || !values) return null;

  const scale = year.valuesScale ?? 1;
  const distribution = dataset.classes.map((item, index) => ({
    id: item.id,
    label: item.label,
    color: item.color,
    ...(item.tone ? { tone: item.tone } : {}),
    percentage: roundReportPercentage(Number(values[index] ?? 0) / scale),
  }));
  const dominantClass = distribution.length
    ? distribution.reduce((dominant, item) =>
        item.percentage > dominant.percentage ? item : dominant,
      )
    : null;

  return {
    period,
    label: year.year?.trim() || period,
    distribution,
    dominantClass,
  };
}

export function buildMunicipalReportTimeSeries(
  dataset: CompactTerritorialAnalysisDataset,
  municipalityCode: string,
): MunicipalReportPeriodSnapshot[] {
  return Object.keys(dataset.years)
    .sort((left, right) => left.localeCompare(right))
    .flatMap((period) => {
      const snapshot = buildMunicipalReportSnapshot(dataset, municipalityCode, period);
      return snapshot ? [snapshot] : [];
    });
}

export function resolveMunicipalReportSnapshot(
  timeSeries: MunicipalReportPeriodSnapshot[],
  requestedPeriod: string,
): MunicipalReportPeriodSnapshot | null {
  const exactPeriod = timeSeries.find(
    (snapshot) => snapshot.period === requestedPeriod,
  );
  if (exactPeriod) return exactPeriod;

  if (!/^\d{4}$/.test(requestedPeriod)) return null;

  const monthlyPeriods = timeSeries.filter((snapshot) =>
    new RegExp(`^${requestedPeriod}-(0[1-9]|1[0-2])$`).test(snapshot.period),
  );

  return monthlyPeriods.at(-1) ?? null;
}

export function getMunicipalReportClasses(
  dataset: CompactTerritorialAnalysisDataset,
): MunicipalReportClass[] {
  return dataset.classes.map(({ id, label, color, tone }) => ({
    id,
    label,
    color,
    ...(tone ? { tone } : {}),
  }));
}
