import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";

/**
 * Como o mapa de um índice legado transforma o raster em classes.
 *
 * - `pixel-codes`: cada classe é um valor inteiro gravado no raster
 *   (`terraibge` usa 1 a 6 e 9 a 14; `cemadenseca` usa 6 a 1, na ordem
 *   inversa da lista de classes).
 * - `value-bounds`: o raster é contínuo e cada classe é uma faixa, delimitada
 *   pelos limites superiores em unidade do asset (`carbonoembrapa` usa
 *   4.999, 6, 8, 10 e 16 g/kg).
 * - `unknown`: não há informação suficiente na entry para afirmar qual dos
 *   dois é, e nesse caso é melhor não adivinhar.
 */
export type LegacyClassificationKind =
  "pixel-codes" | "value-bounds" | "unknown";

export interface LegacyClassification {
  kind: LegacyClassificationKind;
  /**
   * Os códigos de pixel de cada classe, em `pixel-codes`, ou os limites entre
   * as faixas, em `value-bounds`. Vazio em `unknown`.
   */
  values: number[];
}

export interface LegacyScaleRange {
  minScale?: number;
  maxScale?: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Descobre a classificação do mapa a partir do que a entry legada guarda.
 *
 * A ordem das regras não é arbitrária — ela segue as quatro convenções que
 * existem de fato nas entries publicadas, conferidas uma a uma:
 *
 * 1. `mapVisualization.thresholds` explícito é a resposta direta
 *    (`prodprimariabruta`, `prev_anomalia_precipitacao`, os três de pobreza);
 * 2. sem `mapVisualization`, `minScale..maxScale` cobrindo exatamente a
 *    quantidade de classes são códigos consecutivos, porque é assim que
 *    `getImageScale` distribui a paleta — por posição (`deg` com 1 a 6, `ods`
 *    com 9 a 11, `indicearidez` com 2 a 5);
 * 3. todas as classes com `pixelLimit` são códigos de pixel (`terraibge`,
 *    `cemadenseca`, `anaseca`, `CDI_Test`);
 * 4. exatamente uma classe a menos que o total, faltando a última, são limites
 *    superiores: a última faixa é aberta e por isso não tem limite
 *    (`carbonoembrapa`).
 *
 * @example
 * readLegacyClassification(carbono, { minScale: 0, maxScale: 50 });
 * // { kind: "value-bounds", values: [4.999, 6, 8, 10, 16] }
 */
export function readLegacyClassification(
  imageData: CompactTerritorialAnalysisDataset,
  scale: LegacyScaleRange = {},
): LegacyClassification {
  const thresholds = imageData.mapVisualization?.thresholds;
  if (thresholds?.length) {
    return { kind: "value-bounds", values: [...thresholds] };
  }

  const classes = imageData.classes;
  const limits = classes
    .map((entry) => entry.pixelLimit)
    .filter(isFiniteNumber);

  // Sem `mapVisualization`, quem desenha o mapa é `getImageScale`, e ele só usa
  // o `pixelLimit` como código do raster quando esses limites cobrem exatamente
  // `minScale..maxScale`. Fora disso ele manda a paleta por POSIÇÃO no intervalo
  // da escala, e é a escala que diz os códigos. O índice de aridez é esse caso:
  // as classes gravam pixelLimit 1 a 4 numa escala 2 a 5, e o raster usa 2 a 5
  // — o que a tabela de estatísticas confirma, com colunas perc_classe_2 a
  // perc_classe_5. Ler os limites aqui deslocaria a legenda inteira uma casa.
  if (!imageData.mapVisualization) {
    const positional = resolvePositionalCodes(classes.length, limits, scale);
    if (positional) return positional;
  }

  if (limits.length === classes.length) {
    return { kind: "pixel-codes", values: limits };
  }

  // `limits.length > 0` importa: um índice de valor único tem uma classe só e
  // nenhum limite, e sem essa condição ele cairia aqui com uma lista vazia de
  // limites — dizendo "é raster contínuo" sem ter como dizer as faixas.
  const lastHasNoLimit = !isFiniteNumber(classes.at(-1)?.pixelLimit);
  if (
    limits.length > 0 &&
    limits.length === classes.length - 1 &&
    lastHasNoLimit
  ) {
    return { kind: "value-bounds", values: limits };
  }

  return resolveClassificationFromScale(classes.length, scale);
}

/**
 * Códigos deduzidos da escala do painel quando é ela, e não o `pixelLimit`
 * gravado, que diz o valor de cada classe no raster. `null` quando essa leitura
 * não se aplica, para o chamador seguir com as regras seguintes.
 */
function resolvePositionalCodes(
  classCount: number,
  limits: number[],
  { minScale, maxScale }: LegacyScaleRange,
): LegacyClassification | null {
  if (
    !isFiniteNumber(minScale) ||
    !isFiniteNumber(maxScale) ||
    maxScale - minScale + 1 !== classCount
  ) {
    return null;
  }

  // A mesma condição de `getImageScale`: limites contíguos que começam e
  // terminam na escala são os códigos de verdade, e aí eles têm prioridade.
  const limitsCoverTheScale =
    limits.length === classCount &&
    new Set(limits).size === classCount &&
    Math.min(...limits) === minScale &&
    Math.max(...limits) === maxScale;
  if (limitsCoverTheScale) return null;

  return resolveClassificationFromScale(classCount, { minScale, maxScale });
}

function resolveClassificationFromScale(
  classCount: number,
  { minScale, maxScale }: LegacyScaleRange,
): LegacyClassification {
  if (
    !isFiniteNumber(minScale) ||
    !isFiniteNumber(maxScale) ||
    maxScale - minScale + 1 !== classCount
  ) {
    return { kind: "unknown", values: [] };
  }

  return {
    kind: "pixel-codes",
    values: Array.from({ length: classCount }, (_, index) => minScale + index),
  };
}
