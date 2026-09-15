/**
 * A unidade que o painel assume quando o índice não declara nenhuma.
 *
 * É `%` porque toda camada de distribuição por classes mede fração de área, e
 * as camadas legadas nem chegam a publicar `valueConfig`.
 */
export const DEFAULT_MEASUREMENT_UNIT = "%";

export type AnalysisValueType = "percentage" | "absolute";

function resolveUnit(unit?: string): string {
  return unit?.trim() || DEFAULT_MEASUREMENT_UNIT;
}

/**
 * Como a unidade entra depois do número: `%` cola, o resto vem separado por um
 * espaço. Sem isso o painel escreveria "70,3 %" e "742registros".
 *
 * @example
 * `${value.toFixed(1)}${measurementUnitSuffix("registros")}`; // "70,3 registros"
 */
export function measurementUnitSuffix(unit?: string): string {
  const resolved = resolveUnit(unit);
  return resolved === DEFAULT_MEASUREMENT_UNIT ? resolved : ` ${resolved}`;
}

/**
 * O sufixo do valor de um território no painel de análise.
 *
 * Uma contagem sem unidade declarada não recebe sufixo nenhum. Um valor
 * relativo cai na unidade do próprio indicador — é por aqui que um índice
 * publicado em mm, em km² ou num índice adimensional deixa de ser escrito com
 * `%` no ranking de estados só por não ser contagem.
 *
 * @example
 * analysisValueSuffix("percentage", "mm"); // " mm"
 */
export function analysisValueSuffix(
  valueType: AnalysisValueType | undefined,
  unit: string | undefined,
): string {
  if (valueType === "absolute") {
    const trimmed = unit?.trim();
    return trimmed ? ` ${trimmed}` : "";
  }

  return measurementUnitSuffix(unit);
}

/**
 * Se os valores deste índice vão de 0 a 100.
 *
 * Só nessa escala a barra proporcional da distribuição e o eixo travado em 100
 * do gráfico dizem a verdade: num índice de aridez, que vai de 0,2 a 2,7, a
 * barra sairia como um risco e a série inteira ficaria colada no eixo.
 *
 * @example
 * hasPercentageScale("percentage", "mm"); // false
 */
export function hasPercentageScale(
  valueType: AnalysisValueType | undefined,
  unit: string | undefined,
): boolean {
  return (
    valueType !== "absolute" && resolveUnit(unit) === DEFAULT_MEASUREMENT_UNIT
  );
}
