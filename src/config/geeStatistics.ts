import {
  isGeeStatisticsLayerId,
  type GeeStatisticsLayerId,
} from "@/config/geeStatisticsLayers";
import type { GeeFeatureCollectionStatisticsSource } from "@/contracts/geeStatistics";

const CARBON_STATISTICS_ASSET =
  "projects/obscaatinga/assets/_teste_Estatistica_Otimizada_Carbono_2020";
const ANA_STATISTICS_ASSET_TEMPLATE =
  "projects/obscaatinga/assets/Estatisticas/Estatistica_Multinivel_MonitorANA_{year}";

const STANDARD_PROPERTIES = {
  level: "NIVEL_AGRUPAMENTO",
  locationName: "NOME_LOCAL",
  municipalityCode: "CD_MUN",
  stateCode: "NM_UF",
  year: "ano",
  date: "data_img",
  totalArea: "area_total_ha",
} as const;

const STATISTICS_SOURCES: Record<
  GeeStatisticsLayerId,
  GeeFeatureCollectionStatisticsSource
> = {
  carbonoembrapa: {
    kind: "gee-feature-collection",
    asset: {
      type: "fixed",
      assetId:
        process.env.GEE_STATISTICS_CARBON_ASSET_ID?.trim() ||
        CARBON_STATISTICS_ASSET,
    },
    periodGranularity: "year",
    properties: {
      ...STANDARD_PROPERTIES,
      scalarMetrics: {
        mean: "media_Carbono",
        median: "mediana_Carbono",
        mode: "moda_Carbono",
        min: "min_Carbono",
        max: "max_Carbono",
      },
    },
  },
  anaseca: {
    kind: "gee-feature-collection",
    asset: {
      type: "period-template",
      assetIdTemplate:
        process.env.GEE_STATISTICS_ANA_ASSET_TEMPLATE?.trim() ||
        ANA_STATISTICS_ASSET_TEMPLATE,
    },
    periodGranularity: "month",
    properties: STANDARD_PROPERTIES,
  },
};

export function getGeeStatisticsSource(
  panelLayerId: string,
): GeeFeatureCollectionStatisticsSource | null {
  if (process.env.GEE_STATISTICS_ENABLED === "false") {
    return null;
  }

  return isGeeStatisticsLayerId(panelLayerId)
    ? STATISTICS_SOURCES[panelLayerId]
    : null;
}
