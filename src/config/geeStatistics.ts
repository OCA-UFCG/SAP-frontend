import { GEE_STATISTICS_LAYER_IDS } from "@/config/geeStatisticsLayers";

export interface GeeFeatureCollectionStatisticsSource {
  kind: "gee-feature-collection";
  assetId: string;
  levelProperty: string;
  locationNameProperty: string;
  municipalityCodeProperty: string;
  stateCodeProperty: string;
  yearProperty: string;
  dateProperty: string;
  classProperties: string[];
  metricProperties: string[];
}

const CARBON_STATISTICS_ASSET =
  "projects/obscaatinga/assets/Estatistica_Otimizada_Carbono_2020";

const STATISTICS_SOURCES: Record<string, GeeFeatureCollectionStatisticsSource> =
  {
    [GEE_STATISTICS_LAYER_IDS[0]]: {
      kind: "gee-feature-collection",
      assetId:
        process.env.GEE_STATISTICS_CARBON_ASSET_ID?.trim() ||
        CARBON_STATISTICS_ASSET,
      levelProperty: "NIVEL_AGRUPAMENTO",
      locationNameProperty: "NOME_LOCAL",
      municipalityCodeProperty: "CD_MUN",
      stateCodeProperty: "NM_UF",
      yearProperty: "ano",
      dateProperty: "data_img",
      classProperties: [
        "perc_classe_1",
        "perc_classe_2",
        "perc_classe_3",
        "perc_classe_4",
        "perc_classe_5",
        "perc_classe_6",
      ],
      metricProperties: [
        "area_total_ha",
        "area_ha_classe_1",
        "area_ha_classe_2",
        "area_ha_classe_3",
        "area_ha_classe_4",
        "area_ha_classe_5",
        "area_ha_classe_6",
        "media_Carbono",
        "mediana_Carbono",
        "moda_Carbono",
        "min_Carbono",
        "max_Carbono",
      ],
    },
  };

export function getGeeStatisticsSource(
  panelLayerId: string,
): GeeFeatureCollectionStatisticsSource | null {
  if (process.env.GEE_STATISTICS_ENABLED === "false") {
    return null;
  }

  return STATISTICS_SOURCES[panelLayerId] ?? null;
}
