export type SpatialArea = "national" | "region" | "biome" | "semiarid" | "asd";

export type SpatialSelection =
  | { spatialArea: "national"; spatialValue: "brasil" }
  | {
      spatialArea: "region";
      spatialValue: "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
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
