import "server-only";

import citiesIndex from "@/data/citiesIndex.json";
import { MUNICIPAL_REPORT_LAYERS, type MunicipalReportLayerConfig } from "@/config/municipalReport";
import type { MunicipalReportAnalysis, MunicipalReportData } from "@/contracts/municipalReport";
import { getCachedMunicipalAnalysisImageData } from "@/repositories/platform/municipalAnalysisCache";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import { isCompactImageData } from "@/utils/imageData";
import { buildMunicipalReportTimeSeries, getMunicipalReportClasses, resolveMunicipalReportSnapshot } from "@/utils/municipalReport";

export interface MunicipalReportServiceDependencies {
  layers?: readonly MunicipalReportLayerConfig[];
  loadImageData?: typeof getCachedMunicipalAnalysisImageData;
  listPanelLayers?: typeof getPanelLayers;
  now?: () => Date;
}

export class MunicipalReportNotFoundError extends Error {}

function stableAlias(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function resolveReportLayers(dependencies: MunicipalReportServiceDependencies) {
  if (dependencies.layers) return [...dependencies.layers];

  const panelLayers = await (dependencies.listPanelLayers ?? getPanelLayers)();
  const configured = new Map(MUNICIPAL_REPORT_LAYERS.map((layer) => [layer.panelLayerId, layer]));
  return panelLayers.map((layer, index): MunicipalReportLayerConfig => {
    const override = configured.get(layer.id);
    return {
      panelLayerId: layer.id,
      alias: override?.alias ?? stableAlias(layer.id),
      title: layer.name || override?.title || layer.id,
      order: layer.panelPosition ?? override?.order ?? index,
      presentation: override?.presentation,
    };
  });
}

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
  const layers = (await resolveReportLayers(dependencies)).sort((a, b) => a.order - b.order);
  const analyses = await Promise.all(layers.map(async (config): Promise<MunicipalReportAnalysis> => {
    try {
      const result = await loadImageData(config.panelLayerId);
      if (!result.found || !result.imageData || !isCompactImageData(result.imageData)) return unavailable(config, requestedPeriod);
      const timeSeries = buildMunicipalReportTimeSeries(result.imageData, municipalityCode);
      const snapshot = resolveMunicipalReportSnapshot(timeSeries, requestedPeriod);
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
