/**
 * A faixa a que um valor pertence, dados os limites que separam as faixas.
 *
 * Mora em `utils` porque as duas pontas do mesmo índice precisam concordar: o
 * servidor a usa para pintar o raster no Earth Engine e o navegador a usa para
 * pintar a coropleta municipal. Duas cópias divergiriam sem ninguém notar —
 * nenhuma das duas falha, o mapa é que passaria a mostrar faixas diferentes da
 * legenda.
 *
 * O limite é inclusivo à esquerda: um valor igual ao limite já está na faixa de
 * cima.
 *
 * @example
 * classifyValueByThresholds(15, [10, 20], 0); // 1
 */
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
