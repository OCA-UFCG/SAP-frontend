import {
  buildSpatialLocationKey,
  SPATIAL_LOCATION_NAMES,
} from "@/contracts/spatialLocationKey.mjs";
import { statesObj } from "@/utils/constants";

const STATE_UF_BY_NAME = new Map<string, string>(
  Object.entries(statesObj).map(([uf, name]) => [name, uf]),
);

export type SpatialArea =
  | "national"
  | "region"
  | "state"
  | "biome"
  | "semiarid"
  | "asd";

export type SpatialSelection =
  | { spatialArea: "national"; spatialValue: "brasil" }
  | {
      spatialArea: "region";
      spatialValue: "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
    }
  | {
      spatialArea: "state";
      spatialValue:
        | "Acre"
        | "Alagoas"
        | "Amapá"
        | "Amazonas"
        | "Bahia"
        | "Ceará"
        | "Distrito Federal"
        | "Espírito Santo"
        | "Goiás"
        | "Maranhão"
        | "Mato Grosso"
        | "Mato Grosso do Sul"
        | "Minas Gerais"
        | "Pará"
        | "Paraíba"
        | "Paraná"
        | "Pernambuco"
        | "Piauí"
        | "Rio de Janeiro"
        | "Rio Grande do Norte"
        | "Rio Grande do Sul"
        | "Rondônia"
        | "Roraima"
        | "Santa Catarina"
        | "São Paulo"
        | "Sergipe"
        | "Tocantins";
    }
  | {
      spatialArea: "biome";
      spatialValue:
        | "Amazônia"
        | "Caatinga"
        | "Cerrado"
        | "Mata Atlântica"
        | "Pampa"
        | "Pantanal";
    }
  | { spatialArea: "semiarid"; spatialValue: "semiárido" }
  | { spatialArea: "asd"; spatialValue: "ASD" };

export interface SpatialOption<T extends string = string> {
  labelKey: string;
  value: T;
}

export const DEFAULT_SPATIAL_SELECTION: SpatialSelection = {
  spatialArea: "national",
  spatialValue: "brasil",
};

export const SPATIAL_AREA_OPTIONS: readonly SpatialOption<SpatialArea>[] = [
  { value: "national", labelKey: "spatialAreas.national" },
  { value: "region", labelKey: "spatialAreas.region" },
  { value: "state", labelKey: "spatialAreas.state" },
  { value: "biome", labelKey: "spatialAreas.biome" },
  { value: "semiarid", labelKey: "spatialAreas.semiarid" },
  { value: "asd", labelKey: "spatialAreas.asd" },
];

export const SPATIAL_VALUE_OPTIONS: Record<
  SpatialArea,
  readonly SpatialOption[]
> = {
  national: [{ value: "brasil", labelKey: "spatialValues.brasil" }],
  region: [
    { value: "Norte", labelKey: "spatialValues.north" },
    { value: "Nordeste", labelKey: "spatialValues.northeast" },
    { value: "Centro-Oeste", labelKey: "spatialValues.midwest" },
    { value: "Sudeste", labelKey: "spatialValues.southeast" },
    { value: "Sul", labelKey: "spatialValues.south" },
  ],
  state: [
    { value: "Acre", labelKey: "spatialValues.acre" },
    { value: "Alagoas", labelKey: "spatialValues.alagoas" },
    { value: "Amapá", labelKey: "spatialValues.amapa" },
    { value: "Amazonas", labelKey: "spatialValues.amazonas" },
    { value: "Bahia", labelKey: "spatialValues.bahia" },
    { value: "Ceará", labelKey: "spatialValues.ceara" },
    { value: "Distrito Federal", labelKey: "spatialValues.distritoFederal" },
    { value: "Espírito Santo", labelKey: "spatialValues.espiritoSanto" },
    { value: "Goiás", labelKey: "spatialValues.goias" },
    { value: "Maranhão", labelKey: "spatialValues.maranhao" },
    { value: "Mato Grosso", labelKey: "spatialValues.matoGrosso" },
    { value: "Mato Grosso do Sul", labelKey: "spatialValues.matoGrossoDoSul" },
    { value: "Minas Gerais", labelKey: "spatialValues.minasGerais" },
    { value: "Pará", labelKey: "spatialValues.para" },
    { value: "Paraíba", labelKey: "spatialValues.paraiba" },
    { value: "Paraná", labelKey: "spatialValues.parana" },
    { value: "Pernambuco", labelKey: "spatialValues.pernambuco" },
    { value: "Piauí", labelKey: "spatialValues.piaui" },
    { value: "Rio de Janeiro", labelKey: "spatialValues.rioDeJaneiro" },
    { value: "Rio Grande do Norte", labelKey: "spatialValues.rioGrandeDoNorte" },
    { value: "Rio Grande do Sul", labelKey: "spatialValues.rioGrandeDoSul" },
    { value: "Rondônia", labelKey: "spatialValues.rondonia" },
    { value: "Roraima", labelKey: "spatialValues.roraima" },
    { value: "Santa Catarina", labelKey: "spatialValues.santaCatarina" },
    { value: "São Paulo", labelKey: "spatialValues.saoPaulo" },
    { value: "Sergipe", labelKey: "spatialValues.sergipe" },
    { value: "Tocantins", labelKey: "spatialValues.tocantins" },
  ],
  biome: [
    { value: "Amazônia", labelKey: "spatialValues.amazon" },
    { value: "Caatinga", labelKey: "spatialValues.caatinga" },
    { value: "Cerrado", labelKey: "spatialValues.cerrado" },
    {
      value: "Mata Atlântica",
      labelKey: "spatialValues.atlanticForest",
    },
    { value: "Pampa", labelKey: "spatialValues.pampa" },
    { value: "Pantanal", labelKey: "spatialValues.pantanal" },
  ],
  semiarid: [{ value: "semiárido", labelKey: "spatialValues.semiarid" }],
  asd: [{ value: "ASD", labelKey: "spatialValues.asdAndSurroundings" }],
};

interface ValidSpatialSelection {
  ok: true;
  selection: SpatialSelection;
}

interface InvalidSpatialSelection {
  error: string;
  ok: false;
}

export type SpatialSelectionResult =
  InvalidSpatialSelection | ValidSpatialSelection;

const isSpatialArea = (value: string): value is SpatialArea =>
  SPATIAL_AREA_OPTIONS.some((option) => option.value === value);

export function resolveSpatialSelection(
  rawArea?: string | null,
  rawValue?: string | null,
): SpatialSelectionResult {
  const spatialArea = rawArea?.trim();
  const spatialValue = rawValue?.trim();

  if (!spatialArea && !spatialValue) {
    return { ok: true, selection: DEFAULT_SPATIAL_SELECTION };
  }

  if (!spatialArea || !spatialValue) {
    return {
      ok: false,
      error: "spatialArea and spatialValue must be provided together.",
    };
  }

  if (!isSpatialArea(spatialArea)) {
    return {
      ok: false,
      error: `Invalid spatialArea: ${spatialArea}.`,
    };
  }

  const allowedValues = SPATIAL_VALUE_OPTIONS[spatialArea];
  if (!allowedValues.some((option) => option.value === spatialValue)) {
    return {
      ok: false,
      error: `Invalid spatialValue ${spatialValue} for ${spatialArea}.`,
    };
  }

  return {
    ok: true,
    selection: { spatialArea, spatialValue } as SpatialSelection,
  };
}

export function getDefaultSpatialValue(spatialArea: SpatialArea) {
  return SPATIAL_VALUE_OPTIONS[spatialArea][0].value;
}

export function getSpatialScopeLocationKey(
  selection: SpatialSelection,
): string | null {
  if (selection.spatialArea === "national") return "br";

  switch (selection.spatialArea) {
    case "region":
      return buildSpatialLocationKey("2_Regiao", selection.spatialValue);
    case "state":
      return STATE_UF_BY_NAME.get(selection.spatialValue) ?? null;
    case "biome":
      return buildSpatialLocationKey("3_Bioma", selection.spatialValue);
    case "asd":
      return buildSpatialLocationKey(
        "4_ASD",
        SPATIAL_LOCATION_NAMES.asdAndSurroundings,
      );
    case "semiarid":
      return buildSpatialLocationKey(
        "5_Semiarido",
        SPATIAL_LOCATION_NAMES.semiarid,
      );
    default:
      return null;
  }
}

export function getSpatialScopeLocationName(
  selection: SpatialSelection,
): string {
  switch (selection.spatialArea) {
    case "national":
      return "Brasil";
    case "asd":
      return SPATIAL_LOCATION_NAMES.asdAndSurroundings;
    case "semiarid":
      return SPATIAL_LOCATION_NAMES.semiarid;
    default:
      return selection.spatialValue;
  }
}
