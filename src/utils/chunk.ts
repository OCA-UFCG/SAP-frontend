/**
 * Divide uma lista em blocos de tamanho fixo, preservando a ordem.
 *
 * Existe por causa das leituras em lote do Earth Engine: um pedido único é
 * muito mais barato que N pedidos, mas um asset inexistente derruba o pedido
 * inteiro, então o bloco limita quanto trabalho uma falha invalida.
 *
 * @example
 * chunk([1, 2, 3], 2); // [[1, 2], [3]]
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}
