/**
 * Checagem por linha dos percentuais de classe de um asset estatístico.
 *
 * A conta roda aqui, e não no Earth Engine, por uma razão de custo medida: pedir
 * ao GEE um `map()` por linha somando as classes custava ~38 s numa tabela de
 * 67 mil linhas, enquanto trazer as colunas e somar em JavaScript custa ~2,7 s
 * de download e ~3 ms de CPU. O GEE é um motor distribuído de imagens; aritmética
 * linha a linha é o pior uso possível dele. A guarda continua idêntica — todas as
 * linhas são conferidas, com a mesma tolerância.
 */

/**
 * Garante que as colunas de percentual vieram alinhadas: uma lista por
 * propriedade, todas com uma entrada por linha da tabela.
 *
 * `reduceColumns` descarta linhas nulas, e se descartasse em uma coluna e não em
 * outra os índices desalinhariam — a checagem passaria a comparar valores de
 * linhas diferentes e o resultado seria silenciosamente errado. Por isso o
 * desalinhamento é erro, não aviso.
 *
 * @example
 * const columns = parsePercentageColumns(evaluated.list, ["perc_classe_0"], 2, assetId);
 */
export function parsePercentageColumns(
  value: unknown,
  percentageProperties: string[],
  expectedRowCount: number,
  assetId: string,
): number[][] {
  if (!Array.isArray(value) || value.length !== percentageProperties.length) {
    throw new Error(
      `Asset estatístico ${assetId} retornou ${Array.isArray(value) ? value.length : typeof value} coluna(s) de percentual; esperado ${percentageProperties.length} (${percentageProperties.join(", ")}).`,
    );
  }

  return value.map((column, index) => {
    if (!Array.isArray(column) || column.length !== expectedRowCount) {
      throw new Error(
        `Coluna ${percentageProperties[index]} de ${assetId} retornou ${Array.isArray(column) ? column.length : typeof column} valor(es); esperado ${expectedRowCount}, um por linha.`,
      );
    }
    return column as number[];
  });
}

function isValidPercentageRow(
  columns: number[][],
  row: number,
  tolerance: number,
) {
  let sum = 0;
  let allZero = true;
  for (const column of columns) {
    const value = column[row];
    if (!Number.isFinite(value) || value < 0 || value > 100) return false;
    sum += value;
    if (value !== 0) allZero = false;
  }
  return allZero || Math.abs(sum - 100) <= tolerance;
}

/**
 * Conta as linhas cujos percentuais saem de 0–100 ou não somam `100 ± tolerance`.
 * Uma linha com todos os valores zerados representa ausência de dado e é aceita.
 *
 * @example
 * // colunas: perc_classe_0 = [100, 90], perc_classe_1 = [0, 5]
 * countInvalidPercentageRows([[100, 90], [0, 5]], 0.2); // 1 (a linha 2 soma 95)
 */
export function countInvalidPercentageRows(
  columns: number[][],
  tolerance: number,
): number {
  const rowCount = columns[0]?.length ?? 0;
  let invalid = 0;
  for (let row = 0; row < rowCount; row++) {
    if (!isValidPercentageRow(columns, row, tolerance)) invalid++;
  }
  return invalid;
}
