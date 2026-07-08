import "server-only";

import type {
  MunicipalReportAnalysis,
  MunicipalReportChartImage,
  MunicipalReportData,
} from "@/contracts/municipalReport";
import { renderMunicipalReportChart } from "@/services/municipalReportChartRenderer";

function normalizeAnalysisId(value: string) {
  return value.trim().toLowerCase();
}

export function resolveMunicipalReportChartAnalyses(
  report: MunicipalReportData,
  requestedIds: string[],
) {
  const normalizedIds = requestedIds.map(normalizeAnalysisId).filter(Boolean);
  const matchedAnalyses = normalizedIds.map((idOrAlias) => {
    return report.analyses.find(
      (analysis) =>
        analysis.id.toLowerCase() === idOrAlias ||
        analysis.alias.toLowerCase() === idOrAlias,
    );
  });

  const missingAnalyses = normalizedIds.filter((_, index) => !matchedAnalyses[index]);
  const unavailableAnalyses = matchedAnalyses.filter(
    (analysis): analysis is MunicipalReportAnalysis =>
      analysis != null &&
      (analysis.status === "unavailable" || analysis.timeSeries.length === 0),
  );
  const availableAnalyses = matchedAnalyses.filter(
    (analysis): analysis is MunicipalReportAnalysis =>
      analysis != null &&
      analysis.status !== "unavailable" &&
      analysis.timeSeries.length > 0,
  );

  return {
    missingAnalyses,
    unavailableAnalyses,
    availableAnalyses,
  };
}

export async function renderMunicipalReportCharts(
  analyses: readonly MunicipalReportAnalysis[],
  highlightPeriod: string,
): Promise<MunicipalReportChartImage[]> {
  return Promise.all(
    analyses.map(async (analysis) => {
      const png = await renderMunicipalReportChart(analysis, { highlightPeriod });

      return {
        analysisId: analysis.id,
        alias: analysis.alias,
        title: analysis.title,
        period: analysis.effectivePeriod,
        contentType: "image/png",
        base64: png.toString("base64"),
      };
    }),
  );
}
