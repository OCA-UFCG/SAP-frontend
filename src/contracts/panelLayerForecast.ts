const MAX_FACET_LENGTH = 60;

/**
 * Onde um índice de previsão climática fica nos filtros do Monitoramento.
 *
 * Existe porque as previsões são o mesmo produto repetido por fonte, variável,
 * periodicidade e tipo, e o nome não serve para separar isso: os índices
 * publicados escrevem "Anomalia de Temperatura" e "Anomalia Temperatura",
 * "CPTEC INPE" e "CPTEC". Quem cadastra declara os três valores no catálogo; a
 * periodicidade não entra aqui porque já é sabida pela coluna `temporada` da
 * fonte estatística (`hasSeasonalPeriods`).
 *
 * @example
 * const facets: PanelLayerForecastFacets = {
 *   source: "INMET",
 *   variable: "Precipitação",
 *   kind: "Anomalia",
 * };
 */
export interface PanelLayerForecastFacets {
  /** Instituição que produz a previsão: "INMET", "CPTEC". */
  source: string;
  /** Grandeza prevista: "Precipitação", "Temperatura". */
  variable: string;
  /** Como a grandeza é expressa: "Anomalia", "Acumulado", "Probabilidade". */
  kind: string;
}

const FACET_LABELS: Record<keyof PanelLayerForecastFacets, string> = {
  source: "Fonte dos dados",
  variable: "Variável",
  kind: "Tipo",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readFacet(
  value: Record<string, unknown>,
  key: keyof PanelLayerForecastFacets,
) {
  const raw = value[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Valida os filtros digitados no catálogo. Os três vazios significam "não é
 * uma previsão dos filtros" e devolvem `undefined`; preencher só uma parte é
 * erro, porque o índice ficaria fora de alguma combinação sem ninguém notar.
 *
 * @example
 * parseForecastFacetsInput({ source: "INMET", variable: "", kind: "" });
 * // Error: Preencha também Variável e Tipo da previsão climática.
 */
export function parseForecastFacetsInput(
  value: unknown,
): PanelLayerForecastFacets | undefined {
  if (value == null) return undefined;
  if (!isRecord(value)) throw new Error("Filtros da previsão inválidos.");

  const facets = {
    source: readFacet(value, "source"),
    variable: readFacet(value, "variable"),
    kind: readFacet(value, "kind"),
  };
  const keys = Object.keys(facets) as Array<keyof PanelLayerForecastFacets>;
  const missing = keys.filter((key) => !facets[key]);

  if (missing.length === keys.length) return undefined;
  if (missing.length > 0) {
    const labels = missing.map((key) => FACET_LABELS[key]).join(" e ");
    throw new Error(`Preencha também ${labels} da previsão climática.`);
  }

  const tooLong = keys.find((key) => facets[key].length > MAX_FACET_LENGTH);
  if (tooLong) {
    throw new Error(
      `${FACET_LABELS[tooLong]} da previsão aceita até ${MAX_FACET_LENGTH} caracteres.`,
    );
  }

  return facets;
}

/**
 * A leitura do que veio publicado: um valor inválido vira `null` em vez de
 * derrubar a lista de camadas, e o índice aparece como um cartão comum.
 */
export function tryParsePanelLayerForecastFacets(
  value: unknown,
): PanelLayerForecastFacets | null {
  try {
    return parseForecastFacetsInput(value) ?? null;
  } catch {
    return null;
  }
}
