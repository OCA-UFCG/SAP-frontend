import type { EeMapUrlFailure } from "@/contracts/eeMapUrls";

/**
 * De onde sai o desenho de um quadro do relatório: o raster do Earth Engine ou
 * a coropleta municipal de um índice publicado a partir de uma coluna da
 * planilha. `null` é "não há o que desenhar", e é o que faz o quadro mostrar a
 * mensagem em vez de um retângulo mudo.
 */
export type ReportMapSource =
  { kind: "raster"; tileUrl: string } | { kind: "choropleth"; path: string };

/**
 * `municipal_choropleth` não é falha: é "esta camada se desenha de outro jeito".
 * Enquanto o relatório só sabia pedir tiles, ela caía na mesma mensagem de
 * "sem imagem no período" — e todo índice de planilha saía do relatório com um
 * retângulo cinza.
 *
 * @example
 * resolveMapSource(undefined, "municipal_choropleth", "/api/…/choropleth");
 * // { kind: "choropleth", path: "/api/…/choropleth" }
 */
export function resolveMapSource(
  tileUrl: string | undefined,
  unavailableReason: EeMapUrlFailure | undefined,
  choroplethApiPath: string | undefined,
): ReportMapSource | null {
  if (unavailableReason === "municipal_choropleth") {
    return choroplethApiPath
      ? { kind: "choropleth", path: choroplethApiPath }
      : null;
  }
  if (unavailableReason) return null;
  return tileUrl ? { kind: "raster", tileUrl } : null;
}
