/**
 * As contas do desenho da Visão temporal: quais períodos aparecem, como a
 * janela do mini-mapa anda, onde ficam as marcas do eixo, onde cada rótulo da
 * ponta assenta e que cor o traço usa.
 * Ficam fora do componente para serem testadas sem montar o gráfico.
 */

export const MAX_VISIBLE_PERIODS = 8;
// Uma série decendial abre no último ano: 8 decêndios seriam pouco mais de dois
// meses diante dos 926 do CDI.
export const DEKADS_PER_YEAR = 36;
// Puxando as bordas, a janela não fica menor que 4 meses de decêndios.
const MIN_DEKAD_WINDOW = 12;

/**
 * Quantos períodos o gráfico mostra ao abrir. Uma série que cabe inteira não
 * tem mini-mapa: devolve `null`.
 *
 * @example
 * initialWindowSize(927, true); // 36 (o último ano do CDI)
 * initialWindowSize(22, false); // 8
 * initialWindowSize(6, false); // null
 */
export function initialWindowSize(periodCount: number, isDekadSeries: boolean) {
  const size = isDekadSeries ? DEKADS_PER_YEAR : MAX_VISIBLE_PERIODS;
  return periodCount > size ? size : null;
}

/** O menor trecho que a janela aceita ao puxar as bordas. */
export function minWindowSize(periodCount: number, isDekadSeries: boolean) {
  return Math.min(periodCount, isDekadSeries ? MIN_DEKAD_WINDOW : 2);
}

export type TemporalWindow = [start: number, end: number];
export type WindowDragMode = "move" | "start" | "end";

/**
 * A janela depois de um arraste no mini-mapa. `boundary` é a divisa entre
 * períodos sob o ponteiro (de 0 a `periodCount`); no modo "move", `grab` é a
 * distância entre essa divisa e o começo da janela no início do arraste.
 *
 * @example
 * dragWindow([891, 926], "move", 500, 18, 927, 12); // [482, 517]
 * dragWindow([891, 926], "start", 800, 0, 927, 12); // [800, 926]
 */
export function dragWindow(
  [start, end]: TemporalWindow,
  mode: WindowDragMode,
  boundary: number,
  grab: number,
  periodCount: number,
  minSize: number,
): TemporalWindow {
  if (mode === "start") {
    return [clamp(boundary, 0, end - minSize + 1), end];
  }
  if (mode === "end") {
    return [start, clamp(boundary - 1, start + minSize - 1, periodCount - 1)];
  }
  return shiftWindow([start, end], boundary - grab - start, periodCount);
}

/** Anda com a janela sem mudar o tamanho, sem sair da série. */
export function shiftWindow(
  [start, end]: TemporalWindow,
  delta: number,
  periodCount: number,
): TemporalWindow {
  const size = end - start + 1;
  const next = clamp(start + delta, 0, periodCount - size);
  return [next, next + size - 1];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export interface OverviewRun {
  start: number;
  end: number;
  classIndex: number;
}

/**
 * A faixa do mini-mapa: cada período ganha a cor da classe com mais área, e
 * períodos seguidos da mesma classe viram um bloco só (o CDI tem 927
 * decêndios, mas poucas dezenas de blocos).
 *
 * @example
 * dominantRuns([[90, 90, 10], [10, 10, 90]], 3);
 * // [{ start: 0, end: 1, classIndex: 0 }, { start: 2, end: 2, classIndex: 1 }]
 */
export function dominantRuns(
  values: Array<Array<number | null>>,
  periodCount: number,
): OverviewRun[] {
  const runs: OverviewRun[] = [];
  for (let index = 0; index < periodCount; index += 1) {
    let best = -1;
    let bestValue = 0;
    values.forEach((series, classIndex) => {
      const value = series[index];
      if (typeof value === "number" && value > bestValue) {
        best = classIndex;
        bestValue = value;
      }
    });
    const last = runs[runs.length - 1];
    if (best < 0) continue;
    if (last && last.classIndex === best && last.end === index - 1) {
      last.end = index;
    } else {
      runs.push({ start: index, end: index, classIndex: best });
    }
  }
  return runs;
}

/**
 * O topo do eixo de um índice em valor absoluto: o primeiro número "redondo"
 * (1, 2, 2,5 ou 5 vezes uma potência de 10) que cobre o maior valor.
 *
 * @example
 * niceAxisMax(0.65); // 1
 * niceAxisMax(2780); // 5000
 */
export function niceAxisMax(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((factor) => factor * power >= value);
  return (step ?? 10) * power;
}

/**
 * Afasta os rótulos da ponta para não se sobreporem, mantendo cada um o mais
 * perto possível da altura da sua linha. Devolve as posições na mesma ordem
 * de entrada.
 *
 * @example
 * spreadLabelPositions([100, 104, 40], { top: 0, bottom: 200, gap: 14 });
 * // [100, 114, 40]
 */
export function spreadLabelPositions(
  targets: number[],
  bounds: { top: number; bottom: number; gap: number },
) {
  const order = targets
    .map((target, index) => ({ target, index }))
    .sort((left, right) => left.target - right.target);
  const placed = order.map((item) => item.target);

  // Desce: cada rótulo fica pelo menos um espaço abaixo do anterior.
  for (let i = 0; i < placed.length; i += 1) {
    const floor = i === 0 ? bounds.top : placed[i - 1] + bounds.gap;
    placed[i] = Math.max(placed[i], floor);
  }
  // Sobe: quem passou do fundo empurra os de cima.
  for (let i = placed.length - 1; i >= 0; i -= 1) {
    const ceiling =
      i === placed.length - 1 ? bounds.bottom : placed[i + 1] - bounds.gap;
    placed[i] = Math.min(placed[i], ceiling);
  }

  const result = new Array<number>(targets.length);
  order.forEach((item, position) => {
    result[item.index] = placed[position];
  });
  return result;
}

function parseHex(color: string) {
  const hex = color.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const number = Number.parseInt(full, 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

function relativeLuminance([red, green, blue]: number[]) {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
  );
}

const DARKENING_TARGET = [0x55, 0x57, 0x4c];
const MIN_CONTRAST_ON_WHITE = 1.6;

/**
 * A cor do traço sobre o fundo branco. Uma classe quase branca — o "Sem seca"
 * do CDI é `#FFFFFF` — sumiria; ela escurece um pouco, no mesmo tom. A
 * bolinha da legenda continua com a cor do mapa.
 *
 * @example
 * strokeOnWhite("#FFFFFF"); // "#b8b8b4"
 * strokeOnWhite("#6510A2"); // "#6510A2"
 */
export function strokeOnWhite(color: string) {
  const rgb = parseHex(color);
  if (!rgb) return color;
  const contrast = 1.05 / (relativeLuminance(rgb) + 0.05);
  if (contrast >= MIN_CONTRAST_ON_WHITE) return color;
  return (
    "#" +
    rgb
      .map((value, index) =>
        Math.round(value + (DARKENING_TARGET[index] - value) * 0.42)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

const NEAR_WHITE_FILL = "#EBECE6";

/**
 * A cor de um bloco do mini-mapa. Uma classe quase branca vira um cinza bem
 * claro, para o bloco não sumir no fundo branco.
 *
 * @example
 * overviewFill("#FFFFFF"); // "#EBECE6"
 * overviewFill("#FF0000"); // "#FF0000"
 */
export function overviewFill(color: string) {
  const rgb = parseHex(color);
  if (!rgb) return color;
  return relativeLuminance(rgb) > 0.9 ? NEAR_WHITE_FILL : color;
}

export interface AxisTick {
  index: number;
  label: string;
}

const APPROX_CHAR_WIDTH = 6;

/**
 * As marcas do eixo horizontal. Um índice anual ou mensal mostra quantos
 * períodos couberem; um decendial mostra o trimestre num zoom de um ano e o
 * ano (de 1, 2 ou 5 em 5) na série longa, em vez de datas atropeladas.
 */
export function pickAxisTicks(
  periods: string[],
  start: number,
  end: number,
  isDekadSeries: boolean,
  plotWidth: number,
  formatMonth: (year: number, month: number) => string,
): AxisTick[] {
  if (end < start) return [];

  if (!isDekadSeries) {
    const count = end - start + 1;
    const longest = Math.max(
      ...periods.slice(start, end + 1).map((period) => period.length),
    );
    const fits = Math.max(
      2,
      Math.floor(plotWidth / (longest * APPROX_CHAR_WIDTH + 8)),
    );
    const step = Math.max(1, Math.ceil(count / fits));
    const ticks: AxisTick[] = [];
    // Conta a partir do fim, para o período mais recente sempre ter marca.
    for (let index = end; index >= start; index -= step) {
      ticks.unshift({ index, label: periods[index] });
    }
    return ticks;
  }

  const parsed = periods.map((period) => {
    const [year, month, day] = period.split("-").map(Number);
    return { year, month, day };
  });
  const ticks: AxisTick[] = [];

  if (end - start + 1 <= DEKADS_PER_YEAR + 4) {
    for (let index = start; index <= end; index += 1) {
      const { year, month, day } = parsed[index];
      if (day === 1 && (month - 1) % 3 === 0) {
        ticks.push({ index, label: formatMonth(year, month) });
      }
    }
    return ticks;
  }

  const years = parsed[end].year - parsed[start].year;
  const yearStep = years > 12 ? 5 : years > 5 ? 2 : 1;
  for (let index = start; index <= end; index += 1) {
    const { year, month, day } = parsed[index];
    if (month === 1 && day === 1 && year % yearStep === 0) {
      ticks.push({ index, label: String(year) });
    }
  }
  return ticks;
}

/** Corta um nome longo para caber na coluna de rótulos. */
export function shortenLabel(label: string, maxLength: number) {
  return label.length > maxLength
    ? `${label.slice(0, maxLength - 1).trimEnd()}…`
    : label;
}

/**
 * O nome mais longo que cabe na largura, medido com a fonte de verdade. Corta
 * com reticências só quando o nome inteiro não cabe.
 *
 * @example
 * fitLabel("Mosaico de Ocupações", 60, (text) => text.length * 6);
 * // "Mosaico d…"
 */
export function fitLabel(
  label: string,
  maxWidth: number,
  measure: (text: string) => number,
) {
  if (measure(label) <= maxWidth) return label;
  for (let length = label.length - 1; length > 1; length -= 1) {
    const candidate = `${label.slice(0, length).trimEnd()}…`;
    if (measure(candidate) <= maxWidth) return candidate;
  }
  return `${label.slice(0, 1)}…`;
}
