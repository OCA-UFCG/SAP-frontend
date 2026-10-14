/**
 * Decêndio: o mês dividido em três períodos, que começam nos dias 1, 11 e 21.
 * A chave é a data do primeiro dia (`2001-01-11`), igual à coluna de data das
 * tabelas decendiais.
 */

const DEKAD_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(01|11|21)$/u;

export interface DekadPeriod {
  year: number;
  month: number;
  /** 1, 2 ou 3: a ordem do decêndio dentro do mês. */
  dekad: 1 | 2 | 3;
}

/**
 * @example
 * parseDekadPeriod("2001-01-11"); // { year: 2001, month: 1, dekad: 2 }
 * parseDekadPeriod("2001-01"); // null
 */
export function parseDekadPeriod(period: string): DekadPeriod | null {
  const match = DEKAD_KEY_PATTERN.exec(period);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    dekad: ((Number(match[3]) - 1) / 10 + 1) as 1 | 2 | 3,
  };
}

function dekadPrefix(dekad: 1 | 2 | 3, locale: string) {
  const language = locale.slice(0, 2).toLowerCase();
  if (language === "en") {
    return `${["1st", "2nd", "3rd"][dekad - 1]} dekad of `;
  }
  if (language === "es") return `${dekad}.ª década de `;
  return `${dekad}º decêndio de `;
}

/**
 * O decêndio por extenso, ou `null` quando a chave não é de decêndio.
 *
 * @example
 * formatDekadPeriod("2001-01-11", "pt-BR"); // "2º decêndio de janeiro de 2001"
 * formatDekadPeriod("2001-01-21", "en"); // "3rd dekad of January 2001"
 */
export function formatDekadPeriod(
  period: string,
  locale: string,
): string | null {
  const parsed = parseDekadPeriod(period);
  if (!parsed) return null;
  const monthYear = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(parsed.year, parsed.month - 1, 1)));
  return `${dekadPrefix(parsed.dekad, locale)}${monthYear}`;
}
