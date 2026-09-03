import type {
  CompactAnalysisClass,
  CompactTerritorialAnalysisDataset,
} from "@/utils/analysis";
import { normalizeHexColor } from "@/utils/hexColor";

/** Uma linha da legenda: o que a pessoa vê no mapa e pode reescrever. */
export interface LegacyAppearanceRow {
  id: string;
  label: string;
  color: string;
}

/**
 * Onde as linhas da legenda moram dentro do `imageData`.
 *
 * A plataforma resolve a legenda como `mapVisualization.legend ?? classes`
 * (`buildCompactImageParams`, em `src/utils/imageData.ts`), então o catálogo
 * grava no mesmo lugar de onde o mapa lê — e não nos dois.
 */
export type LegacyAppearanceLegendSource =
  "classes" | "mapVisualization.legend";

export interface LegacyAppearance {
  legendSource: LegacyAppearanceLegendSource;
  legend: LegacyAppearanceRow[];
  /**
   * As classes, quando elas não são a legenda. Nos índices de valor único
   * (pobreza, registros do S2iD) `classes` tem uma linha só — o nome da série
   * medida, que aparece no painel de análise e no gráfico — enquanto as faixas
   * coloridas do mapa estão em `mapVisualization.legend`.
   */
  series?: LegacyAppearanceRow[];
  /** Limites entre as faixas, na unidade do asset. Só quando já existem. */
  thresholds?: number[];
  thresholdUnit?: string;
  /**
   * Quantas cores tem a paleta gravada; 0 quando o mapa deriva a paleta da
   * própria legenda e não há nada a sincronizar.
   */
  paletteLength: number;
}

export interface LegacyAppearanceInput {
  legend: LegacyAppearanceRow[];
  series?: LegacyAppearanceRow[];
  thresholds?: number[];
}

function toRow(entry: CompactAnalysisClass): LegacyAppearanceRow {
  return { id: entry.id, label: entry.label, color: entry.color };
}

function getOwnLegend(imageData: CompactTerritorialAnalysisDataset) {
  const legend = imageData.mapVisualization?.legend;
  return Array.isArray(legend) && legend.length > 0 ? legend : undefined;
}

/**
 * A superfície editável de aparência de um índice legado.
 *
 * @example
 * readLegacyAppearance(imageData).legend; // [{ id: "seca-fraca", label: "Seca fraca", color: "#FFEB3B" }]
 */
export function readLegacyAppearance(
  imageData: CompactTerritorialAnalysisDataset,
): LegacyAppearance {
  const ownLegend = getOwnLegend(imageData);
  const mapVisualization = imageData.mapVisualization;
  const thresholds = mapVisualization?.thresholds?.length
    ? [...mapVisualization.thresholds]
    : undefined;

  return {
    legendSource: ownLegend ? "mapVisualization.legend" : "classes",
    legend: (ownLegend ?? imageData.classes).map(toRow),
    ...(ownLegend ? { series: imageData.classes.map(toRow) } : {}),
    ...(thresholds ? { thresholds } : {}),
    ...(mapVisualization?.sourceRange?.unit
      ? { thresholdUnit: mapVisualization.sourceRange.unit }
      : {}),
    paletteLength: mapVisualization?.palette?.length ?? 0,
  };
}

function parseRow(value: unknown, path: string): LegacyAppearanceRow {
  const row = value as Partial<LegacyAppearanceRow> | null;
  const id = typeof row?.id === "string" ? row.id.trim() : "";
  const label = typeof row?.label === "string" ? row.label.trim() : "";
  const color =
    typeof row?.color === "string" ? normalizeHexColor(row.color) : null;

  if (!id || !label || !color) {
    throw new Error(
      `${path} deve ter id, rótulo e cor no formato #RRGGBB; recebido ${JSON.stringify(value)}.`,
    );
  }

  return { id, label, color };
}

function parseRows(value: unknown, field: string): LegacyAppearanceRow[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `${field} deve ser uma lista não vazia de linhas {id, label, color}; recebido ${JSON.stringify(value)}.`,
    );
  }

  return value.map((row, index) => parseRow(row, `${field}[${index}]`));
}

function parseThresholds(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `thresholds deve ser uma lista não vazia de números; recebido ${JSON.stringify(value)}.`,
    );
  }

  const numbers = value.map(Number);
  if (numbers.some((number) => !Number.isFinite(number))) {
    throw new Error(
      `thresholds deve ter apenas números finitos; recebido ${JSON.stringify(value)}.`,
    );
  }

  // Ordem crescente estrita: dois limites iguais deixariam uma faixa sem
  // nenhum valor possível, e uma faixa vazia é uma cor que nunca aparece.
  if (
    numbers.some((number, index) => index > 0 && number <= numbers[index - 1])
  ) {
    throw new Error(
      `thresholds deve estar em ordem crescente; recebido ${JSON.stringify(numbers)}.`,
    );
  }

  return numbers;
}

/**
 * Valida o corpo enviado pela tela de aparência.
 *
 * O corpo carrega só rótulos, cores e limites — nunca o `imageData` inteiro.
 * O servidor relê o objeto gravado e aplica a alteração em cima dele, para que
 * os valores territoriais (centenas de KB por índice) nunca passem pelo
 * navegador e não possam voltar corrompidos.
 *
 * @example
 * parseLegacyAppearanceInput({ legend: [{ id: "c1", label: "Seca", color: "#ca281b" }] });
 */
export function parseLegacyAppearanceInput(
  raw: unknown,
): LegacyAppearanceInput {
  const body = (raw ?? {}) as Record<string, unknown>;

  return {
    legend: parseRows(body.legend, "legend"),
    ...(body.series == null
      ? {}
      : { series: parseRows(body.series, "series") }),
    ...(body.thresholds == null
      ? {}
      : { thresholds: parseThresholds(body.thresholds) }),
  };
}

/**
 * O catálogo não cria, remove nem reordena linhas de um índice legado: os
 * valores gravados em cada período são listas na ordem das classes
 * (`values[locationKey][i]` é a classe `i`), então mexer na lista
 * desalinharia todos os números já publicados.
 */
function assertSameRows(
  current: LegacyAppearanceRow[],
  next: LegacyAppearanceRow[],
  field: string,
) {
  const currentIds = current.map((row) => row.id).join(", ");
  const nextIds = next.map((row) => row.id).join(", ");

  if (currentIds !== nextIds) {
    throw new Error(
      `As linhas de ${field} têm de ser as mesmas e na mesma ordem: o índice tem [${currentIds}] e a edição enviou [${nextIds}].`,
    );
  }
}

/**
 * Duas cores iguais escritas de formas diferentes.
 *
 * A tela normaliza tudo para `#RRGGBB` em maiúsculas, e a maioria dos legados
 * está gravada em minúsculas (`#e99957`). Sem esta comparação, abrir um índice
 * e salvar sem editar nada reescreveria todas as cores só para trocar a caixa
 * das letras, e marcaria o índice publicado como "alterações não publicadas"
 * sem que nada tivesse mudado no mapa.
 */
function normalizeColorDigits(color: string) {
  return color.replace(/^#/u, "").toUpperCase();
}

function isSameColor(left: string, right: string) {
  return normalizeColorDigits(left) === normalizeColorDigits(right);
}

function applyRow(
  target: CompactAnalysisClass,
  row: LegacyAppearanceRow,
): CompactAnalysisClass {
  const colorChanged = !isSameColor(target.color, row.color);
  const updated = {
    ...target,
    label: row.label,
    color: colorChanged ? row.color : target.color,
  };

  // `tone` são as cores do chip no painel de análise, derivadas da cor da
  // classe. Mantê-lo depois de trocar a cor deixaria o painel exibindo a cor
  // antiga; sem ele o painel recalcula o tom a partir de `color`
  // (`getCompactClassTone`, em `src/components/analysis/analysis.mappers.ts`).
  if (colorChanged) delete updated.tone;

  return updated;
}

function applyLegendRows(
  next: CompactTerritorialAnalysisDataset,
  source: LegacyAppearanceLegendSource,
  rows: LegacyAppearanceRow[],
) {
  if (source === "classes") {
    next.classes = next.classes.map((entry, index) =>
      applyRow(entry, rows[index]),
    );
    return;
  }

  const mapVisualization = next.mapVisualization;
  if (!mapVisualization?.legend) return;
  mapVisualization.legend = mapVisualization.legend.map((entry, index) =>
    applyRow(entry, rows[index]),
  );
}

function applySeriesRows(
  next: CompactTerritorialAnalysisDataset,
  current: LegacyAppearance,
  rows: LegacyAppearanceRow[],
) {
  if (!current.series) {
    throw new Error(
      `Este índice não tem série separada das faixas: as ${current.legend.length} linhas da legenda já são as classes dele.`,
    );
  }

  assertSameRows(current.series, rows, "classes");
  next.classes = next.classes.map((entry, index) =>
    applyRow(entry, rows[index]),
  );
}

function applyThresholds(
  next: CompactTerritorialAnalysisDataset,
  current: LegacyAppearance,
  thresholds: number[],
) {
  if (!current.thresholds) {
    throw new Error(
      "Este índice não classifica o mapa por limites numéricos, então não há limites para editar.",
    );
  }

  if (current.thresholds.length !== thresholds.length) {
    throw new Error(
      `A quantidade de limites não pode mudar: o índice tem ${current.thresholds.length} e a edição enviou ${thresholds.length}.`,
    );
  }

  const mapVisualization = next.mapVisualization;
  if (mapVisualization) mapVisualization.thresholds = thresholds;
}

/**
 * A qual linha da legenda pertence cada casa da paleta, descoberto pela cor que
 * está gravada em cada uma.
 *
 * A paleta é indexada pelo valor de pixel do raster, e não pela posição da
 * linha na legenda: `cemadenseca` lista as classes com `pixelLimit` de 6 a 1 e
 * a paleta de 1 a 6, exatamente na ordem inversa. Sincronizar por posição
 * inverteria as cores do mapa inteiro — e a conferência de aparência não pegaria
 * isso, porque a paleta é um campo que esta edição tem permissão de escrever.
 *
 * Devolve `null` quando alguma casa não corresponde a exatamente uma linha, o
 * único caso em que não há como saber qual faixa ela pinta.
 */
function mapPaletteSlotsToRows(
  palette: string[],
  rows: LegacyAppearanceRow[],
): number[] | null {
  const slotRows = palette.map((slot) => {
    const matches = rows.filter((row) => isSameColor(row.color, slot));
    return matches.length === 1 ? rows.indexOf(matches[0]) : -1;
  });

  return slotRows.includes(-1) ? null : slotRows;
}

/**
 * A paleta gravada é o que o Earth Engine recebe para pintar o raster, e a
 * legenda é o que a pessoa lê ao lado do mapa. Deixar as duas fora de sincronia
 * é o pior resultado possível: um mapa cujas cores não querem dizer o que a
 * legenda diz.
 */
function applyPalette(
  next: CompactTerritorialAnalysisDataset,
  previous: LegacyAppearanceRow[],
  rows: LegacyAppearanceRow[],
) {
  const stored = next.mapVisualization?.palette;
  // Sem paleta gravada, o Earth Engine deriva as cores da própria legenda; e
  // uma edição que só mexeu em rótulos não tem por que tocar nas cores do mapa.
  if (!stored) return;
  if (
    !rows.some((row, index) => !isSameColor(previous[index].color, row.color))
  ) {
    return;
  }

  if (stored.length !== rows.length) {
    throw new Error(
      `A paleta do mapa tem ${stored.length} cores e a legenda tem ${rows.length} linhas, então o catálogo não sabe qual cor vai em qual faixa. Corrija a paleta no Contentful antes de editar as cores por aqui.`,
    );
  }

  const slotRows = mapPaletteSlotsToRows(stored, previous);
  if (!slotRows) {
    throw new Error(
      `A paleta do mapa (${stored.join(", ")}) tem cores que não correspondem a exatamente uma linha da legenda, então o catálogo não sabe qual faixa cada uma pinta. Alinhe a paleta com as cores da legenda no Contentful antes de editar as cores por aqui.`,
    );
  }

  const mapVisualization = next.mapVisualization;
  if (!mapVisualization) return;
  mapVisualization.palette = stored.map((slot, index) => {
    const color = rows[slotRows[index]].color;
    if (isSameColor(slot, color)) return slot;
    // Preserva a convenção da entry: `cemadenseca` grava a paleta sem `#`, e o
    // Earth Engine aceita as duas formas.
    return slot.startsWith("#") ? color : normalizeColorDigits(color);
  });
}

const APPEARANCE_KEYS = ["label", "color", "tone"] as const;

function withoutRowAppearance(entry: CompactAnalysisClass) {
  const rest = { ...entry } as Record<string, unknown>;
  for (const key of APPEARANCE_KEYS) delete rest[key];
  return rest;
}

function withoutAppearance(imageData: CompactTerritorialAnalysisDataset) {
  const clone = structuredClone(imageData) as unknown as Record<
    string,
    unknown
  >;
  clone.classes = imageData.classes.map(withoutRowAppearance);

  if (imageData.mapVisualization) {
    const mapVisualization = {
      ...imageData.mapVisualization,
    } as Record<string, unknown>;
    delete mapVisualization.palette;
    delete mapVisualization.thresholds;
    if (imageData.mapVisualization.legend) {
      mapVisualization.legend =
        imageData.mapVisualization.legend.map(withoutRowAppearance);
    }
    clone.mapVisualization = mapVisualization;
  }

  return clone;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, entryValue]) =>
        `${JSON.stringify(key)}:${canonicalJson(entryValue)}`,
    );
  return `{${entries.join(",")}}`;
}

/**
 * Confere que a edição mexeu apenas em rótulos, cores, paleta e limites.
 *
 * Existe porque gravar o `imageData` de um índice legado significa reescrever o
 * campo que também guarda os valores territoriais dele — até 200 KB de números
 * por índice, sem outra cópia no Contentful. Um erro aqui não é uma tela
 * errada: é um dado perdido. O `imageData` novo é construído por cópia do
 * antigo, então esta conferência só falha se alguém mudar essa construção — e é
 * exatamente para esse dia que ela está aqui.
 */
export function assertOnlyAppearanceChanged(
  before: CompactTerritorialAnalysisDataset,
  after: CompactTerritorialAnalysisDataset,
) {
  if (
    canonicalJson(withoutAppearance(before)) ===
    canonicalJson(withoutAppearance(after))
  ) {
    return;
  }

  throw new Error(
    "A edição de aparência mudaria algo além de rótulos, cores e limites do índice legado, e por isso não foi gravada. Nada além de aparência pode ser editado neste escopo.",
  );
}

/**
 * Aplica rótulos, cores e limites novos ao `imageData` gravado.
 *
 * Sempre por cópia do objeto original: campos que o contrato não conhece
 * (`value`, `pixelLimit`, `valuesScale`) e os valores de cada período seguem
 * intactos porque nenhuma linha é reconstruída do zero.
 *
 * @example
 * applyLegacyAppearance(imageData, { legend: [{ id: "c1", label: "Seca fraca", color: "#FFEB3B" }] });
 */
export function applyLegacyAppearance(
  imageData: CompactTerritorialAnalysisDataset,
  input: LegacyAppearanceInput,
): CompactTerritorialAnalysisDataset {
  const current = readLegacyAppearance(imageData);
  assertSameRows(current.legend, input.legend, "legenda");

  const next = structuredClone(imageData);
  applyLegendRows(next, current.legendSource, input.legend);
  if (input.series) applySeriesRows(next, current, input.series);
  if (input.thresholds) applyThresholds(next, current, input.thresholds);
  applyPalette(next, current.legend, input.legend);
  assertOnlyAppearanceChanged(imageData, next);

  return next;
}

function countChangedRows(
  before: LegacyAppearanceRow[],
  after: LegacyAppearanceRow[],
  key: "label" | "color",
) {
  return before.filter((row, index) => {
    const next = after[index]?.[key];
    if (next === undefined) return true;
    return key === "color" ? !isSameColor(row[key], next) : row[key] !== next;
  }).length;
}

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Resumo da alteração para o registro de auditoria e para a mensagem da tela.
 *
 * @example
 * summarizeLegacyAppearanceChange(before, after); // "2 rótulos e 1 cor"
 */
export function summarizeLegacyAppearanceChange(
  before: CompactTerritorialAnalysisDataset,
  after: CompactTerritorialAnalysisDataset,
): string {
  const previous = readLegacyAppearance(before);
  const current = readLegacyAppearance(after);
  const rows = [...previous.legend, ...(previous.series ?? [])];
  const nextRows = [...current.legend, ...(current.series ?? [])];
  const labels = countChangedRows(rows, nextRows, "label");
  const colors = countChangedRows(rows, nextRows, "color");
  const changes = [
    labels > 0 ? pluralize(labels, "rótulo", "rótulos") : "",
    colors > 0 ? pluralize(colors, "cor", "cores") : "",
    canonicalJson(previous.thresholds) === canonicalJson(current.thresholds)
      ? ""
      : "os limites do mapa",
  ].filter(Boolean);

  if (changes.length === 0) return "nada";
  return changes.length === 1
    ? changes[0]
    : `${changes.slice(0, -1).join(", ")} e ${changes[changes.length - 1]}`;
}
