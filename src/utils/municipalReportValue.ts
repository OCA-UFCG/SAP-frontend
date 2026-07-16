import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";

type MunicipalReportValueSemantics = Pick<
  MunicipalReportAnalysis,
  "unit" | "valueType"
>;

function normalizedUnit(analysis: MunicipalReportValueSemantics) {
  return analysis.unit.trim();
}

export function formatMunicipalReportValue(
  value: number,
  analysis: MunicipalReportValueSemantics,
  locale: string,
) {
  if (analysis.valueType === "percentage") return `${value.toFixed(1)}%`;

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}

export function formatMunicipalReportValueWithUnit(
  value: number,
  analysis: MunicipalReportValueSemantics,
  locale: string,
) {
  const formattedValue = formatMunicipalReportValue(value, analysis, locale);
  const unit = normalizedUnit(analysis);
  return analysis.valueType === "absolute" && unit
    ? `${formattedValue} ${unit}`
    : formattedValue;
}

export function getMunicipalReportValueLabels(
  analysis: MunicipalReportValueSemantics,
  t?: (key: string, values?: Record<string, string>) => string,
) {
  if (analysis.valueType === "percentage") {
    return {
      cardContext: t
        ? t("valueLabels.percentageCardContext")
        : "da área analisada",
      sectionTitle: t
        ? t("valueLabels.percentageSectionTitle")
        : "Classes",
      tableValue: t
        ? t("valueLabels.percentageTableValue")
        : "Cobertura (%)",
      chartSeries: t
        ? t("valueLabels.percentageChartSeries")
        : "Série temporal por classe",
    };
  }

  const unit = normalizedUnit(analysis);
  if (!t) {
    return {
      cardContext: unit ? `${unit} no município` : "valor total no município",
      sectionTitle: "Valores",
      tableValue: unit ? `Total (${unit})` : "Valor total",
      chartSeries: "Série temporal de valores",
    };
  }

  return {
    cardContext: unit
      ? t("valueLabels.absoluteCardContextUnit", { unit })
      : t("valueLabels.absoluteCardContextNoUnit"),
    sectionTitle: t("valueLabels.absoluteSectionTitle"),
    tableValue: unit
      ? t("valueLabels.absoluteTableValueUnit", { unit })
      : t("valueLabels.absoluteTableValueNoUnit"),
    chartSeries: t("valueLabels.absoluteChartSeries"),
  };
}
