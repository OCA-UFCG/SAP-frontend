import "server-only";

import citiesIndex from "@/data/citiesIndex.json";
import { MUNICIPAL_REPORT_LAYERS, type MunicipalReportLayerConfig } from "@/config/municipalReport";
import type { MunicipalReportAnalysis, MunicipalReportData } from "@/contracts/municipalReport";
import { getCachedMunicipalAnalysisImageData } from "@/repositories/platform/municipalAnalysisCache";
import { isCompactImageData } from "@/utils/imageData";
import { buildMunicipalReportSnapshot, buildMunicipalReportTimeSeries, getMunicipalReportClasses } from "@/utils/municipalReport";

export interface MunicipalReportServiceDependencies {
  layers?: readonly MunicipalReportLayerConfig[];
  loadImageData?: typeof getCachedMunicipalAnalysisImageData;
  now?: () => Date;
}

export class MunicipalReportNotFoundError extends Error {}

function unavailable(config: MunicipalReportLayerConfig, period: string): MunicipalReportAnalysis {
  return { id: config.panelLayerId, alias: config.alias, title: config.title, unit: "%", status: "unavailable", requestedPeriod: period, effectivePeriod: null, classes: [], snapshot: null, timeSeries: [] };
}

export async function buildMunicipalReport(
  municipalityCode: string,
  requestedPeriod: string,
  dependencies: MunicipalReportServiceDependencies = {},
): Promise<MunicipalReportData> {
  const municipality = citiesIndex.find((city) => city.code === municipalityCode);
  if (!municipality) throw new MunicipalReportNotFoundError("Municipality not found.");

  const loadImageData = dependencies.loadImageData ?? getCachedMunicipalAnalysisImageData;
  const layers = [...(dependencies.layers ?? MUNICIPAL_REPORT_LAYERS)].sort((a, b) => a.order - b.order);
  const analyses = await Promise.all(layers.map(async (config): Promise<MunicipalReportAnalysis> => {
    try {
      const result = await loadImageData(config.panelLayerId);
      if (!result.found || !result.imageData || !isCompactImageData(result.imageData)) return unavailable(config, requestedPeriod);
      const timeSeries = buildMunicipalReportTimeSeries(result.imageData, municipalityCode);
      const snapshot = buildMunicipalReportSnapshot(result.imageData, municipalityCode, requestedPeriod);
      return {
        id: config.panelLayerId, alias: config.alias, title: config.title, unit: "%",
        status: snapshot ? "available" : "period_not_found",
        requestedPeriod, effectivePeriod: snapshot?.period ?? null,
        classes: getMunicipalReportClasses(result.imageData), snapshot, timeSeries,
      };
    } catch (error) {
      console.error(`[municipalReport] Falha ao carregar ${config.panelLayerId}:`, error);
      return unavailable(config, requestedPeriod);
    }
  }));

  const templateVariables: MunicipalReportData["templateVariables"] = {
    municipio: municipality.name,
    uf: municipality.uf.toUpperCase(),
    codigoMunicipio: municipality.code,
  };
  for (const analysis of analyses) {
    templateVariables[`classe_${analysis.alias}`] = analysis.snapshot?.dominantClass?.label ?? null;
    templateVariables[`percentual_${analysis.alias}`] = analysis.snapshot?.dominantClass?.percentage ?? null;
    templateVariables[`periodo_${analysis.alias}`] = analysis.effectivePeriod;
  }

  return {
    schemaVersion: 1,
    generatedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
    requestedPeriod,
    municipality: { code: municipality.code, name: municipality.name, uf: municipality.uf.toUpperCase() },
    analyses,
    templateVariables,
  };
}
