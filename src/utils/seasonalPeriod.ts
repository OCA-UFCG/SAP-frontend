import type { PanelLayerI } from "@/utils/interfaces";

/**
 * Índices de previsão sazonal guardam no Earth Engine um trimestre por linha,
 * nomeado pela sigla de três letras que junta a inicial de cada mês ("SON" =
 * setembro, outubro, novembro), enquanto a chave do período continua sendo o
 * mês em que o trimestre começa (`2026-09`). Como a sigla é função direta desse
 * mês, a plataforma só precisa saber **se** a camada é sazonal — e isso vem da
 * coluna `temporada` detectada na publicação do catálogo.
 */

const MONTH_PERIOD_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/u;
const QUARTER_MONTH_COUNT = 3;

/**
 * `true` quando a fonte estatística publicada declara a coluna do trimestre.
 *
 * @example hasSeasonalPeriods(layer) // true para "Previsão: Anomalia Temperatura Trimestral"
 */
export function hasSeasonalPeriods(
  layer: Pick<PanelLayerI, "statisticsSource"> | null | undefined,
): boolean {
  const source = layer?.statisticsSource;

  return Boolean(
    source &&
    source.kind === "gee-feature-collection" &&
    // `properties` pode faltar numa fonte que nao passou pelo contrato.
    source.properties?.season,
  );
}

const MONTH_INITIALS = "JFMAMJJASOND";

/**
 * A sigla que o asset deveria ter no período, para conferir se a coluna
 * `temporada` descreve o trimestre daquele mês ou apenas a emissão.
 *
 * @example seasonAcronymForPeriod("2026-09") // "SON"
 */
export function seasonAcronymForPeriod(periodKey: string): string | null {
  const match = MONTH_PERIOD_PATTERN.exec(periodKey.trim());

  if (!match) {
    return null;
  }

  const startMonthIndex = Number(match[2]) - 1;

  return Array.from(
    { length: QUARTER_MONTH_COUNT },
    (_, offset) => MONTH_INITIALS[(startMonthIndex + offset) % 12],
  ).join("");
}

/**
 * `true` quando a sigla de cada período é a do trimestre que começa naquele
 * mês — o que distingue um índice trimestral de um mensal cujo asset carrega a
 * sigla da emissão.
 *
 * @example seasonPairsDescribeQuarters([["2026-09", "SON"], ["2026-10", "OND"]])
 * // => true (CPTEC trimestral)
 * @example seasonPairsDescribeQuarters([["2026-10", "OND"], ["2026-11", "OND"]])
 * // => false (INMET mensal, sigla da emissão repetida)
 */
export function seasonPairsDescribeQuarters(
  pairs: ReadonlyArray<readonly [string, string]>,
): boolean {
  return (
    pairs.length > 0 &&
    pairs.every(
      ([period, season]) =>
        season.trim().toUpperCase() === seasonAcronymForPeriod(period),
    )
  );
}

function formatMonthName(monthIndex: number, locale: string): string {
  const name = new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, monthIndex % 12, 1)));

  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Rótulo do trimestre que começa no mês da chave, ou `null` quando a chave não
 * é um mês. O ano é o do mês inicial, como no asset: `2026-12` é
 * "Dezembro - Janeiro - Fevereiro - 2026".
 *
 * @example formatSeasonalPeriodLabel("2026-09")
 * // => "Setembro - Outubro - Novembro - 2026"
 */
export function formatSeasonalPeriodLabel(
  periodKey: string | null | undefined,
  locale = "pt-BR",
): string | null {
  const match = MONTH_PERIOD_PATTERN.exec(periodKey?.trim() ?? "");

  if (!match) {
    return null;
  }

  const startMonthIndex = Number(match[2]) - 1;
  const months = Array.from({ length: QUARTER_MONTH_COUNT }, (_, offset) =>
    formatMonthName(startMonthIndex + offset, locale),
  );

  return [...months, match[1]].join(" - ");
}

/**
 * Último mês do trimestre em chave comparável como texto (`2026-11`), usada
 * para descartar o trimestre que já terminou.
 */
export function resolveSeasonEndMonthKey(periodKey: string): string | null {
  const match = MONTH_PERIOD_PATTERN.exec(periodKey.trim());

  if (!match) {
    return null;
  }

  const endMonthIndex = Number(match[2]) - 1 + (QUARTER_MONTH_COUNT - 1);
  const endYear = Number(match[1]) + Math.floor(endMonthIndex / 12);

  return `${endYear}-${String((endMonthIndex % 12) + 1).padStart(2, "0")}`;
}
