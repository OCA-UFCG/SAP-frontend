import type {
  MunicipalReportAnalysis,
  MunicipalReportPeriodSnapshot,
} from "@/contracts/municipalReport";

export const MUNICIPAL_REPORT_PDF_CHART_MAX_MEASUREMENTS = 10;

interface BuildMunicipalReportChartDataOptions {
  maxMeasurements?: number;
}

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

export function selectMunicipalReportChartSnapshots(
  timeSeries: MunicipalReportPeriodSnapshot[],
  maxMeasurements?: number,
): MunicipalReportPeriodSnapshot[] {
  const sortedSnapshots = [...timeSeries].sort((left, right) =>
    left.period.localeCompare(right.period),
  );

  if (maxMeasurements == null) return sortedSnapshots;
  if (maxMeasurements <= 0) return [];
  return sortedSnapshots.slice(-maxMeasurements);
}

export function buildMunicipalReportChartData(
  analysis: MunicipalReportAnalysis,
  highlightPeriod: string,
  options: BuildMunicipalReportChartDataOptions = {},
): MunicipalReportChartData {
  const referencePeriod = analysis.effectivePeriod ?? highlightPeriod;
  const snapshots = selectMunicipalReportChartSnapshots(
    analysis.timeSeries,
    options.maxMeasurements,
  );

  const categories = snapshots.map((snapshot) => ({
    period: snapshot.period,
    label: snapshot.label || snapshot.period,
    highlighted:
      snapshot.period === highlightPeriod ||
      snapshot.period === referencePeriod,
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

function parseHexColor(color: string) {
  const hex = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  const [red, green, blue] = [0, 2, 4].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  );
  return { red, green, blue };
}

function toHex(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, "0");
}

/**
 * A cor de uma classe escurecida o bastante para aparecer sobre o branco.
 *
 * As classes claras da legenda (um amarelo de 0,95 de luminância, por exemplo)
 * somem como linha do gráfico e como bolinha da tabela. Escurecer só as claras
 * preserva a cor da legenda em todo o resto.
 *
 * @example
 * getVisibleChartColor("#FFF9C4"); // "#b8b38d"
 */
export function getVisibleChartColor(color: string) {
  const parsed = parseHexColor(color);
  if (!parsed) return "#536E7B";

  const luminance =
    parsed.red * 0.299 + parsed.green * 0.587 + parsed.blue * 0.114;
  if (luminance <= 190) return color;

  return `#${toHex(parsed.red * 0.72)}${toHex(parsed.green * 0.72)}${toHex(parsed.blue * 0.72)}`;
}
