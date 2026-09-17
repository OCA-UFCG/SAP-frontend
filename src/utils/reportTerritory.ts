import type {
  MunicipalReportTerritory,
  MunicipalReportTerritoryLevel,
} from "@/contracts/municipalReport";
import citiesIndex from "@/data/citiesIndex.json";
import { statesObj } from "@/utils/constants";
import { MUNICIPALITY_KEY_PATTERN } from "@/utils/statisticsLocationScope";
import {
  getSpatialScopeLocationKey,
  SPATIAL_VALUE_OPTIONS,
  type SpatialArea,
  type SpatialSelection,
} from "@/utils/spatialScope";

export type ReportTerritoryLevel = MunicipalReportTerritoryLevel;

/**
 * O território de um relatório, em todas as formas que o texto precisa.
 *
 * Existe porque o relatório deixou de ser só municipal: a mesma chave
 * territorial (`2504009`, `pb`, `br`, `3_bioma-caatinga`) vira o filtro da
 * leitura no Earth Engine, o título do documento e o sujeito das frases
 * escritas no catálogo. Cada uma dessas três precisa de uma grafia diferente do
 * mesmo lugar, e derivá-las em pontos separados faria o título e a frase
 * discordarem.
 *
 * As formas com preposição são pt-BR e vêm prontas do servidor porque a
 * contração depende do gênero do recorte — "no bioma Caatinga" mas "na região
 * Nordeste" —, e essa é justamente a regra que quem escreve o texto no catálogo
 * não tem como aplicar: quando ele escreve a frase, ainda não sabe em que
 * recorte ela será lida.
 *
 * @example
 * resolveReportTerritory("3_bioma-caatinga")?.prepositionalLabel;
 * // "No bioma Caatinga"
 */
export interface ReportTerritory extends MunicipalReportTerritory {
  municipalityCode?: string;
  /**
   * A seleção equivalente em Monitoramento, para o mapa reaproveitar o
   * enquadramento e o contorno que o painel já resolve. Ausente no município,
   * que tem malha própria e não é uma área de interesse.
   */
  selection?: SpatialSelection;
}

interface TerritoryPhrases {
  kindLabel: string;
  /** O que vem depois de "N-" e de "d-", já com artigo: "o município de ". */
  prefix: string;
  /** A contração da preposição "em": "no", "na" ou "nas". */
  contraction: "no" | "na" | "nas";
}

/** Artigo do nome de cada UF em "estado ___ Bahia". */
const STATE_ARTICLE: Record<string, "do" | "da" | "de"> = {
  ac: "do",
  al: "de",
  ap: "do",
  am: "do",
  ba: "da",
  ce: "do",
  df: "do",
  es: "do",
  go: "de",
  ma: "do",
  mt: "de",
  ms: "de",
  mg: "de",
  pa: "do",
  pb: "da",
  pr: "do",
  pe: "de",
  pi: "do",
  rj: "do",
  rn: "do",
  rs: "do",
  ro: "de",
  rr: "de",
  sc: "de",
  sp: "de",
  se: "de",
  to: "do",
};

function buildPhrases(
  { kindLabel, prefix, contraction }: TerritoryPhrases,
  label: string,
) {
  const possessivePrefix =
    contraction === "na" ? "da" : contraction === "nas" ? "das" : "do";
  const prepositional = `${contraction} ${prefix}${label}`;

  return {
    kindLabel,
    prepositionalLabel:
      prepositional.charAt(0).toUpperCase() + prepositional.slice(1),
    possessiveLabel: `${possessivePrefix} ${prefix}${label}`,
  };
}

function resolveMunicipality(locationKey: string): ReportTerritory | null {
  const municipality = citiesIndex.find((city) => city.code === locationKey);
  if (!municipality) return null;

  const uf = municipality.uf.toUpperCase();
  const label = `${municipality.name} — ${uf}`;

  return {
    locationKey,
    level: "municipality",
    name: municipality.name,
    label,
    uf,
    municipalityCode: locationKey,
    ...buildPhrases(
      { kindLabel: "município", prefix: "município de ", contraction: "no" },
      label,
    ),
  };
}

function resolveState(locationKey: string): ReportTerritory | null {
  const name = statesObj[locationKey as keyof typeof statesObj];
  if (!name) return null;

  return {
    locationKey,
    level: "state",
    name,
    label: name,
    uf: locationKey.toUpperCase(),
    selection: { spatialArea: "state", spatialValue: name } as SpatialSelection,
    ...buildPhrases(
      {
        kindLabel: "estado",
        prefix: `estado ${STATE_ARTICLE[locationKey] ?? "de"} `,
        contraction: "no",
      },
      name,
    ),
  };
}

const NATIONAL_TERRITORY: ReportTerritory = {
  locationKey: "br",
  level: "national",
  name: "Brasil",
  label: "Brasil",
  selection: { spatialArea: "national", spatialValue: "brasil" },
  ...buildPhrases(
    { kindLabel: "país", prefix: "", contraction: "no" },
    "Brasil",
  ),
};

const AGGREGATE_PHRASES: Record<
  Extract<SpatialArea, "region" | "biome" | "asd" | "semiarid">,
  TerritoryPhrases
> = {
  region: { kindLabel: "região", prefix: "região ", contraction: "na" },
  biome: { kindLabel: "bioma", prefix: "bioma ", contraction: "no" },
  asd: { kindLabel: "ASD", prefix: "", contraction: "nas" },
  semiarid: { kindLabel: "semiárido", prefix: "", contraction: "no" },
};

const AGGREGATE_LEVEL_BY_AREA: Record<
  keyof typeof AGGREGATE_PHRASES,
  ReportTerritoryLevel
> = {
  region: "region",
  biome: "biome",
  asd: "asd",
  semiarid: "semiarid",
};

/**
 * Os recortes agregados, indexados pela chave territorial que o Earth Engine
 * conhece. A tabela é construída a partir das mesmas opções do painel de
 * Monitoramento, e não escrita à mão, para que um bioma novo apareça nos dois
 * lugares ou em nenhum.
 */
const AGGREGATE_TERRITORIES = new Map<string, ReportTerritory>(
  (Object.keys(AGGREGATE_PHRASES) as Array<keyof typeof AGGREGATE_PHRASES>)
    .flatMap((spatialArea) =>
      SPATIAL_VALUE_OPTIONS[spatialArea].map(
        (option): ReportTerritory | null => {
          const selection = {
            spatialArea,
            spatialValue: option.value,
          } as SpatialSelection;
          const locationKey = getSpatialScopeLocationKey(selection);
          if (!locationKey) return null;
          const name = resolveAggregateName(selection);

          return {
            locationKey,
            level: AGGREGATE_LEVEL_BY_AREA[spatialArea],
            name,
            label: name,
            selection,
            ...buildPhrases(AGGREGATE_PHRASES[spatialArea], name),
          };
        },
      ),
    )
    .filter((territory): territory is ReportTerritory => territory !== null)
    .map((territory): [string, ReportTerritory] => [
      territory.locationKey,
      territory,
    ]),
);

function resolveAggregateName(selection: SpatialSelection): string {
  if (selection.spatialArea === "asd") return "ASD e Entorno";
  if (selection.spatialArea === "semiarid") return "Semiárido";
  return selection.spatialValue;
}

/**
 * O território de uma chave territorial, ou `null` quando ela não descreve
 * nenhum recorte conhecido.
 *
 * É esta função que a rota do relatório usa como validação: aceitar só o que
 * ela resolve substitui o antigo `^\d{7}$` sem abrir a rota para uma chave
 * arbitrária chegar ao filtro do Earth Engine.
 *
 * @example resolveReportTerritory("pb")?.label; // "Paraíba"
 */
export function resolveReportTerritory(
  locationKey: string,
): ReportTerritory | null {
  const key = locationKey.trim();
  if (!key) return null;
  if (key === "br") return NATIONAL_TERRITORY;
  if (MUNICIPALITY_KEY_PATTERN.test(key)) return resolveMunicipality(key);
  if (/^[a-z]{2}$/u.test(key)) return resolveState(key);

  return AGGREGATE_TERRITORIES.get(key) ?? null;
}

/**
 * Se a chave tem a forma de uma chave territorial, mesmo que o território não
 * exista.
 *
 * Serve à validação de rota, que precisa separar os dois casos: uma chave
 * malformada é um pedido inválido (400), e um código IBGE bem formado mas
 * inexistente é um território não encontrado (404) — a mesma distinção que a
 * rota fazia quando só aceitava município.
 *
 * @example
 * isReportTerritoryKeyShape("9999999"); // true, embora não exista
 * isReportTerritoryKeyShape("../etc");  // false
 */
export function isReportTerritoryKeyShape(locationKey: string): boolean {
  const key = locationKey.trim();

  return (
    key === "br" ||
    MUNICIPALITY_KEY_PATTERN.test(key) ||
    /^[a-z]{2}$/u.test(key) ||
    /^[2-5]_[a-z]+-[a-z0-9-]+$/u.test(key)
  );
}

/** A chave territorial de uma seleção do painel, para o formulário do relatório. */
export function getReportTerritoryForSelection(
  selection: SpatialSelection,
): ReportTerritory | null {
  const locationKey = getSpatialScopeLocationKey(selection);
  return locationKey ? resolveReportTerritory(locationKey) : null;
}
