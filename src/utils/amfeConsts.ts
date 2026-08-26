import { AnalysisLevel, interestArea } from "./amfeInterfaces";

export const apiVersions = [{ label: "Versão 1.0", value: "1.0" }];

export const accent = "#989F43";
export const inputBg = "#d7d7d6";
export const text = "#292829";

export const rankingLevelsByInterestArea: Record<
  interestArea,
  AnalysisLevel[]
> = {
  national: ["national", "region", "biome", "state"],
  region: ["region", "biome", "state"],
  biome: ["biome", "state"],
  state: ["state"],
  semiarid: ["national", "state"],
  asd: ["national", "state"],
};

export const interestAreas: { value: interestArea; label: string }[] = [
  { value: "national", label: "Nacional" },
  { value: "region", label: "Regional" },
  { value: "biome", label: "Bioma" },
  { value: "state", label: "Estadual" },
  { value: "semiarid", label: "Semiárido" },
  { value: "asd", label: "ASD e Entorno" },
];
export const interestAreaOptionsByLevel: Record<interestArea, string[]> = {
  national: ["brasil"],
  state: [
    "AC",
    "AL",
    "AP",
    "AM",
    "BA",
    "CE",
    "DF",
    "ES",
    "GO",
    "MA",
    "MT",
    "MS",
    "MG",
    "PA",
    "PB",
    "PR",
    "PE",
    "PI",
    "RJ",
    "RN",
    "RS",
    "RO",
    "RR",
    "SC",
    "SP",
    "SE",
    "TO",
  ],
  region: ["Norte", "Nordeste", "Centro-oeste", "Sudeste", "Sul"],
  biome: [
    "Amazônia",
    "Caatinga",
    "Cerrado",
    "Mata Atlântica",
    "Pampa",
    "Pantanal",
  ],
  semiarid: ["semiarid"],
  asd: ["asd"],
};
