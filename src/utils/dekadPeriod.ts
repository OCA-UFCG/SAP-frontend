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

/** O último dia do decêndio: 10, 20 ou o fim do mês (28 a 31). */
function dekadLastDay({ year, month, dekad }: DekadPeriod) {
  if (dekad < 3) return dekad * 10;
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Os dias do decêndio por extenso, ou `null` quando a chave não é de decêndio.
 * Mostrar os dias, e não "2º decêndio", dispensa quem lê de saber o que é um
 * decêndio.
 *
 * @example
 * formatDekadPeriod("2026-09-11", "pt-BR"); // "11 a 20 de setembro de 2026"
 * formatDekadPeriod("2026-02-21", "pt-BR"); // "21 a 28 de fevereiro de 2026"
 * formatDekadPeriod("2026-09-01", "en"); // "September 1–10, 2026"
 */
export function formatDekadPeriod(
  period: string,
  locale: string,
): string | null {
  const parsed = parseDekadPeriod(period);
  if (!parsed) return null;
  const firstDay = (parsed.dekad - 1) * 10 + 1;
  const lastDay = dekadLastDay(parsed);
  const monthName = new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(parsed.year, parsed.month - 1, 1)));

  const language = locale.slice(0, 2).toLowerCase();
  if (language === "en") {
    return `${monthName} ${firstDay}–${lastDay}, ${parsed.year}`;
  }
  if (language === "es") {
    return `${firstDay} al ${lastDay} de ${monthName} de ${parsed.year}`;
  }
  return `${firstDay} a ${lastDay} de ${monthName} de ${parsed.year}`;
}
