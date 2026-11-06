import type { MunicipalReportTerritory } from "@/contracts/municipalReport";
import { SPATIAL_VALUE_OPTIONS } from "@/utils/spatialScope";

type Translate = (key: string) => string;

/** A chave em `AnalysisPanel.spatialValues` do nome de cada recorte. */
function spatialValueKey(territory: MunicipalReportTerritory) {
  switch (territory.level) {
    case "national":
      return "spatialValues.brasil";
    case "semiarid":
      return "spatialValues.semiarid";
    case "asd":
      return "spatialValues.asdAndSurroundings";
    case "state":
    case "region":
    case "biome":
      return SPATIAL_VALUE_OPTIONS[territory.level].find(
        (option) => option.value === territory.name,
      )?.labelKey;
    default:
      return undefined;
  }
}

/**
 * O território do relatório com o nome e as frases no idioma da página.
 *
 * O servidor manda as formas flexionadas do português ("No bioma Caatinga",
 * "do estado da Paraíba"), que dependem do gênero de cada recorte. Em inglês e
 * espanhol os textos já trazem a preposição ("In {place}"), então as três
 * formas viram só o nome traduzido. `name` e `locationKey` não mudam: o mapa e
 * o nome do arquivo continuam usando a grafia original.
 *
 * @example
 * localizeReportTerritory(caatinga, "en", tPanel, tReport).prepositionalLabel;
 * // "Caatinga"
 */
export function localizeReportTerritory(
  territory: MunicipalReportTerritory,
  locale: string,
  tPanel: Translate,
  tReport: Translate,
): MunicipalReportTerritory {
  if (locale === "pt") return territory;
  const key = spatialValueKey(territory);
  const label = key ? tPanel(key) : territory.label;

  return {
    ...territory,
    label,
    kindLabel: tReport(`scopes.${territory.level}`).toLocaleLowerCase(locale),
    prepositionalLabel: label,
    possessiveLabel: label,
  };
}
