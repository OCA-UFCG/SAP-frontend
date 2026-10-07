import { statesObj } from "@/utils/constants";
import {
  DEFAULT_SPATIAL_SELECTION,
  type SpatialSelection,
} from "@/utils/spatialScope";
import type { interestArea } from "@/utils/amfeInterfaces";

/**
 * A AMFE e o restante da plataforma nomeiam as mesmas áreas de formas
 * diferentes: o backend da análise espera sigla de UF (`PB`), `Centro-oeste`,
 * `semiarid` e `asd`, enquanto `SpatialSelection` usa nome completo
 * (`Paraíba`), `Centro-Oeste`, `semiárido` e `ASD`. Traduzir aqui, num único
 * ponto, evita que a divergência vaze para o mapa ou para o payload.
 */
export interface AmfeInterestArea {
  type: interestArea;
  value: string;
}

const STATE_NAME_BY_UF = new Map(
  Object.entries(statesObj).map(([uf, name]) => [uf.toUpperCase(), name]),
);

const REGION_NAME_BY_AMFE_VALUE = new Map([
  ["norte", "Norte"],
  ["nordeste", "Nordeste"],
  ["centro-oeste", "Centro-Oeste"],
  ["sudeste", "Sudeste"],
  ["sul", "Sul"],
]);

const BIOME_NAMES = new Set([
  "Amazônia",
  "Caatinga",
  "Cerrado",
  "Mata Atlântica",
  "Pampa",
  "Pantanal",
]);

/**
 * Converte a área de interesse do formulário da AMFE na `SpatialSelection` que
 * o mapa da plataforma entende. Devolve `null` quando o valor não corresponde a
 * nenhuma área conhecida, para que quem chama decida entre esperar ou ignorar.
 *
 * @example
 * toSpatialSelection({ type: "state", value: "PB" });
 * // → { spatialArea: "state", spatialValue: "Paraíba" }
 */
export const toSpatialSelection = (
  interestArea: AmfeInterestArea | null | undefined,
): SpatialSelection | null => {
  if (!interestArea) return null;

  const { type, value } = interestArea;

  if (type === "national") return DEFAULT_SPATIAL_SELECTION;
  if (type === "semiarid") {
    return { spatialArea: "semiarid", spatialValue: "semiárido" };
  }
  if (type === "asd") return { spatialArea: "asd", spatialValue: "ASD" };

  if (type === "state") {
    const stateName = STATE_NAME_BY_UF.get(value.toUpperCase());
    return stateName
      ? ({ spatialArea: "state", spatialValue: stateName } as SpatialSelection)
      : null;
  }

  if (type === "region") {
    const regionName = REGION_NAME_BY_AMFE_VALUE.get(value.toLowerCase());
    return regionName
      ? ({ spatialArea: "region", spatialValue: regionName } as SpatialSelection)
      : null;
  }

  return BIOME_NAMES.has(value)
    ? ({ spatialArea: "biome", spatialValue: value } as SpatialSelection)
    : null;
};
