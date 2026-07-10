import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";

export interface MunicipalReportChartPoint {
  period: string;
  label: string;
  value: number;
  highlighted: boolean;
}

export interface MunicipalReportChartSeries {
  id: string;
  label: string;
  color: string;
  points: MunicipalReportChartPoint[];
}

export interface MunicipalReportChartData {
  categories: Array<{ period: string; label: string; highlighted: boolean }>;
  series: MunicipalReportChartSeries[];
  referencePeriod: string | null;
}

export function buildMunicipalReportChartData(
  analysis: MunicipalReportAnalysis,
  highlightPeriod: string,
): MunicipalReportChartData {
  const referencePeriod = analysis.effectivePeriod ?? highlightPeriod;
  const snapshots = [...analysis.timeSeries].sort((left, right) =>
    left.period.localeCompare(right.period),
  );

  const categories = snapshots.map((snapshot) => ({
    period: snapshot.period,
    label: snapshot.label || snapshot.period,
    highlighted:
      snapshot.period === highlightPeriod || snapshot.period === referencePeriod,
  }));

  const series = analysis.classes.map((analysisClass) => ({
    id: analysisClass.id,
    label: analysisClass.label,
    color: analysisClass.color,
    points: snapshots.map((snapshot) => {
      const item = snapshot.distribution.find(
        (distributionItem) => distributionItem.id === analysisClass.id,
      );

      return {
        period: snapshot.period,
        label: snapshot.label || snapshot.period,
        value: item?.percentage ?? 0,
        highlighted:
          snapshot.period === highlightPeriod ||
          snapshot.period === referencePeriod,
      };
    }),
  }));

  return { categories, series, referencePeriod };
}
