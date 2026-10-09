import type { PanelLayerI } from "@/utils/interfaces";
import { hasSeasonalPeriods } from "@/utils/seasonalPeriod";

/**
 * As previsões climáticas aparecem no Monitoramento como um produto só, em que
 * a pessoa escolhe fonte, variável, periodicidade e tipo, e cada combinação é
 * um `panelLayer` próprio. Este módulo decide qual camada responde a uma
 * escolha e quais opções de cada filtro existem a partir dela.
 *
 * Os filtros são lidos na ordem da tela: uma opção fica habilitada quando
 * existe camada com ela e com o que já está escolhido nos filtros de cima.
 * Escolher uma opção mantém os filtros de cima e, nos de baixo, mantém o que
 * ainda existir — o que sumir cai na primeira opção disponível.
 */

export type ForecastPeriodicity = "monthly" | "quarterly";

export const FORECAST_DIMENSIONS = [
  "source",
  "variable",
  "periodicity",
  "kind",
] as const;

export type ForecastDimension = (typeof FORECAST_DIMENSIONS)[number];

export interface ForecastSelection {
  source: string;
  variable: string;
  periodicity: ForecastPeriodicity;
  kind: string;
}

export interface ForecastMember extends ForecastSelection {
  layer: PanelLayerI;
}

export interface ForecastDimensionOption {
  /** O valor como foi cadastrado, ou a periodicidade (`monthly`, `quarterly`). */
  value: string;
  enabled: boolean;
  selected: boolean;
}

const PERIODICITY_ORDER: readonly ForecastPeriodicity[] = [
  "monthly",
  "quarterly",
];

/** "Precipitação" e "precipitacao " são a mesma opção. */
function normalizeFacet(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function sameFacet(left: string, right: string): boolean {
  return normalizeFacet(left) === normalizeFacet(right);
}

/**
 * As camadas que entram nos filtros, na ordem do painel. Fica de fora quem não
 * declarou os filtros no catálogo.
 *
 * @example
 * getForecastMembers(panelLayers).map((member) => member.layer.id);
 * // ["previsao-anomalia-precipitacao-mensal-inmet", ...]
 */
export function getForecastMembers(
  layers: readonly PanelLayerI[],
): ForecastMember[] {
  return layers.flatMap((layer) =>
    layer.forecastFacets
      ? [
          {
            layer,
            ...layer.forecastFacets,
            periodicity: hasSeasonalPeriods(layer) ? "quarterly" : "monthly",
          },
        ]
      : [],
  );
}

function compareOptionValues(
  dimension: ForecastDimension,
  left: string,
  right: string,
): number {
  if (dimension === "periodicity") {
    return (
      PERIODICITY_ORDER.indexOf(left as ForecastPeriodicity) -
      PERIODICITY_ORDER.indexOf(right as ForecastPeriodicity)
    );
  }

  return left.localeCompare(right, "pt-BR");
}

/** Os valores distintos de um filtro, em ordem alfabética (ou mensal antes de trimestral). */
function distinctValues(
  members: readonly ForecastMember[],
  dimension: ForecastDimension,
): string[] {
  const values: string[] = [];

  for (const member of members) {
    const value = member[dimension];
    if (!values.some((existing) => sameFacet(existing, value))) {
      values.push(value);
    }
  }

  return values.sort((left, right) =>
    compareOptionValues(dimension, left, right),
  );
}

/**
 * A camada que responde a uma escolha, aceitando a mais próxima quando a
 * combinação exata não existe: cada filtro, de cima para baixo, mantém o valor
 * pedido se ele existir entre as camadas que sobraram, e senão cai no primeiro.
 *
 * @example
 * // CPTEC não tem "Acumulado": a fonte muda e o tipo cai em "Anomalia".
 * resolveForecastSelection(members, { ...atual, source: "CPTEC" });
 */
export function resolveForecastSelection(
  members: readonly ForecastMember[],
  desired: Partial<ForecastSelection>,
): ForecastMember | null {
  let candidates = [...members];

  for (const dimension of FORECAST_DIMENSIONS) {
    const values = distinctValues(candidates, dimension);
    if (values.length === 0) return null;

    const wanted = desired[dimension];
    const chosen =
      (wanted && values.find((value) => sameFacet(value, wanted))) ??
      values[0];
    candidates = candidates.filter((member) =>
      sameFacet(member[dimension], chosen),
    );
  }

  return candidates[0] ?? null;
}

/**
 * As opções de cada filtro diante da camada escolhida.
 *
 * @example
 * getForecastFilterOptions(members, inmetTemperaturaMensal).kind;
 * // [{ value: "Acumulado", enabled: false }, { value: "Anomalia", enabled: true, selected: true }, ...]
 */
export function getForecastFilterOptions(
  members: readonly ForecastMember[],
  current: ForecastSelection,
): Record<ForecastDimension, ForecastDimensionOption[]> {
  let candidates = [...members];
  const options = {} as Record<ForecastDimension, ForecastDimensionOption[]>;

  for (const dimension of FORECAST_DIMENSIONS) {
    const available = candidates;
    options[dimension] = distinctValues(members, dimension).map((value) => ({
      value,
      enabled: available.some((member) => sameFacet(member[dimension], value)),
      selected: sameFacet(current[dimension], value),
    }));
    candidates = candidates.filter((member) =>
      sameFacet(member[dimension], current[dimension]),
    );
  }

  return options;
}
