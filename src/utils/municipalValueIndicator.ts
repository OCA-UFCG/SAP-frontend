import type {
  ClassMapping,
  MunicipalValueIndicator,
} from "@/types/indexCatalog";
import type { CompactAnalysisTemplates } from "@/utils/analysis";

/**
 * Como a unidade entra no fim da frase: `%` cola no número e o resto vem
 * separado por espaço, senão o painel escreveria "70,3 %" e "742registros".
 */
function unitSuffix(measurementUnit: string) {
  return measurementUnit === "%" ? "%" : ` ${measurementUnit}`;
}

/**
 * As frases do painel para um indicador de valor único.
 *
 * São geradas do rótulo e da unidade em vez de virarem quatro campos no
 * formulário: o operador do catálogo já descreveu o indicador uma vez, e cada
 * campo a mais é uma frase a mais para manter coerente entre os índices.
 *
 * @example
 * buildValueTemplates({ label: "Registros de secas", measurementUnit: "registros", ... });
 * // { country: "Registros de secas no {name}: {value} registros.", ... }
 */
export function buildValueTemplates(
  indicator: MunicipalValueIndicator,
): CompactAnalysisTemplates {
  const suffix = unitSuffix(indicator.measurementUnit);
  return {
    country: `${indicator.label} no {name}: {value}${suffix}.`,
    state: `${indicator.label} em {name}: {value}${suffix}.`,
    municipality: `${indicator.label} em {name}: {value}${suffix}.`,
    highlight: indicator.label,
  };
}

/**
 * As faixas de cor do mapa, com o valor de pixel que a classificação por limites
 * produz.
 *
 * `classifyValueByThresholds` devolve `min + posição`, então as faixas ocupam
 * `0..n-1` e a paleta cai exatamente sobre elas.
 */
export function buildRangeClasses(configured: ClassMapping[]): ClassMapping[] {
  return configured.map((entry, position) => ({
    ...entry,
    classIndex: position,
    pixelValue: position,
  }));
}

/**
 * Os limites que separam as faixas de cor, recusados quando não há um a menos
 * que o número de faixas: com um limite sobrando ou faltando o mapa pintaria
 * uma faixa inteira com a cor da vizinha, sem nenhum erro visível.
 */
export function requireValueThresholds(
  thresholds: number[] | undefined,
  rangeCount: number,
): number[] {
  const configured = thresholds ?? [];
  if (configured.length !== rangeCount - 1) {
    throw new Error(
      `Informe exatamente ${rangeCount - 1} limite(s) para separar as ${rangeCount} faixas de cor do mapa.`,
    );
  }
  return configured;
}
