import type { CompactMapVisualizationConfig } from "@/utils/analysis";
import type { IImageParam } from "@/utils/interfaces";

export interface ThresholdClassificationPlan {
  outputBand?: string;
  startValue: number;
  thresholds: number[];
}

/**
 * Valores de pixel esparsos traduzidos para posições densas, uma por cor da
 * paleta: `from[i]` é o valor da classe no raster e `to[i]` é a posição dela.
 */
export interface CategoricalRemapPlan {
  from: number[];
  to: number[];
}

export interface ResolvedMapVisualizationPlan {
  sourceType?: CompactMapVisualizationConfig["sourceType"];
  property?: string;
  outline?: CompactMapVisualizationConfig["outline"];
  sourceBand?: string;
  thresholdClassification?: ThresholdClassificationPlan;
  categoricalRemap?: CategoricalRemapPlan;
  visParams: {
    min: number;
    max: number;
    palette: string[];
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getFallbackPalette(imageParams: IImageParam[]) {
  return imageParams
    .map((imageParam) => imageParam.color)
    .filter((color): color is string => typeof color === "string");
}

export function classifyValueByThresholds(
  value: number,
  thresholds: number[],
  startValue: number,
) {
  return thresholds.reduce(
    (currentClass, threshold, index) =>
      value >= threshold ? startValue + index + 1 : currentClass,
    startValue,
  );
}

/**
 * Plano de remapeamento quando as classes da camada não ocupam todos os valores
 * entre `min` e `max`, ou `undefined` quando não há nada a remapear.
 *
 * O Earth Engine distribui a paleta linearmente entre `min` e `max`. Numa camada
 * cujas classes são 1 a 6 e 9 a 14 (a cobertura do solo do IBGE), são 12 cores
 * espalhadas por 14 valores: a classe 5 recebe a cor da 4, a 6 recebe a da 5, e
 * assim por diante. Traduzir cada valor de classe para a posição dela na paleta
 * resolve isso, e tem um efeito colateral desejável — o `remap` do Earth Engine
 * mascara os valores que não estão na lista, então um pixel que não pertence a
 * nenhuma classe da camada deixa de ser pintado com a cor de outra.
 *
 * As posições começam em 1, e não em 0, porque `selfMask()` roda depois e
 * apagaria a primeira classe se ela virasse zero.
 *
 * @example
 * resolveCategoricalRemap([{ pixelLimit: 1 }, { pixelLimit: 9 }], 2, 1, 9);
 * // { from: [1, 9], to: [1, 2] }
 */
export function resolveCategoricalRemap(
  legend: CompactMapVisualizationConfig["legend"],
  paletteLength: number,
  min: number,
  max: number,
): CategoricalRemapPlan | undefined {
  const pixelValues = (legend ?? [])
    .map((entry) => entry.pixelLimit)
    .filter(isFiniteNumber);

  // Uma legenda incompleta não diz qual cor pertence a qual valor, e adivinhar
  // seria pior que manter o comportamento atual.
  if (pixelValues.length !== paletteLength || paletteLength === 0) {
    return undefined;
  }
  if (!pixelValues.every(Number.isInteger)) return undefined;
  if (new Set(pixelValues).size !== pixelValues.length) return undefined;
  if (pixelValues.some((value) => value < min || value > max)) return undefined;
  // Faixa densa: a paleta já cai em cima dos valores certos.
  if (max - min + 1 === paletteLength) return undefined;

  return {
    from: pixelValues,
    to: pixelValues.map((_value, position) => position + 1),
  };
}

/**
 * Se a camada desenha classes discretas, e por isso só está correta na escala
 * nativa do asset.
 *
 * Longe, o Earth Engine serve a pirâmide do asset em vez do dado original, e
 * todos os assets do catálogo a constroem por MÉDIA (`pyramidingPolicy: MEAN`).
 * Para um dado contínuo isso é legítimo — a média de anomalias ainda é uma
 * anomalia. Para classes não é: a média entre "Vegetação Florestal" (6) e
 * "Corpo d'água" (12) é 9, que é "Área Úmida", uma classe que não está ali.
 * Medido no semiárido em z5: o Índice de Degradação da Terra exibia "Nível 1"
 * em 16,3% da tela contra 0,3% reais, e a Cobertura da Terra perdia 9% da
 * camada em buracos brancos.
 *
 * Uma camada com `thresholds` está fora porque o dado dela é contínuo: a
 * classificação por faixas roda depois e já entrega uma classe válida.
 *
 * @example
 * isCategoricalMapVisualization({ legend: [{ pixelLimit: 1 }, { pixelLimit: 2 }] }); // true
 */
export function isCategoricalMapVisualization(
  mapVisualization: CompactMapVisualizationConfig,
) {
  if (mapVisualization.sourceType === "featureCollection") return false;
  if (mapVisualization.thresholds?.length) return false;

  const pixelValues = (mapVisualization.legend ?? [])
    .map((entry) => entry.pixelLimit)
    .filter(isFiniteNumber);

  return pixelValues.length > 0 && pixelValues.every(Number.isInteger);
}

export function resolveMapVisualizationPlan(
  mapVisualization: CompactMapVisualizationConfig,
  imageParams: IImageParam[],
  minScale: number,
  maxScale: number,
): ResolvedMapVisualizationPlan {
  const thresholds = Array.isArray(mapVisualization.thresholds)
    ? mapVisualization.thresholds.filter(isFiniteNumber)
    : [];
  const hasThresholds = thresholds.length > 0;
  const palette =
    Array.isArray(mapVisualization.palette) &&
    mapVisualization.palette.length > 0
      ? mapVisualization.palette
      : getFallbackPalette(imageParams);
  const min = isFiniteNumber(mapVisualization.min)
    ? mapVisualization.min
    : (minScale ?? 0);
  const max = isFiniteNumber(mapVisualization.max)
    ? mapVisualization.max
    : (maxScale ?? (palette.length > 0 ? min + palette.length - 1 : min));
  const sourceBand = hasThresholds
    ? (mapVisualization.sourceBand ??
      (mapVisualization.outputBand ? undefined : mapVisualization.band))
    : (mapVisualization.band ?? mapVisualization.sourceBand);

  // A classificação por limites já produz valores densos a partir de `min`, e
  // remapear em cima disso desfaria o que ela acabou de montar.
  const categoricalRemap = hasThresholds
    ? undefined
    : resolveCategoricalRemap(
        mapVisualization.legend,
        palette.length,
        min,
        max,
      );

  return {
    sourceType: mapVisualization.sourceType,
    property: mapVisualization.property,
    outline: mapVisualization.outline,
    sourceBand,
    visParams: categoricalRemap
      ? { min: 1, max: palette.length, palette }
      : { min, max, palette },
    ...(categoricalRemap ? { categoricalRemap } : {}),
    ...(hasThresholds
      ? {
          thresholdClassification: {
            outputBand: mapVisualization.outputBand ?? mapVisualization.band,
            startValue: min,
            thresholds,
          },
        }
      : {}),
  };
}
