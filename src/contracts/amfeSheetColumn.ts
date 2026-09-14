import { isGeeStatisticsRecord } from "@/contracts/geeStatisticsAsset";

/**
 * O `kind` de uma camada cujos valores territoriais vêm de uma coluna da
 * planilha da análise multicritério, e não de um asset do Earth Engine.
 */
export const AMFE_SHEET_COLUMN_KIND = "amfe-sheet-column";

/** Como Brasil e UF saem das linhas municipais, igual à tabela municipal GEE. */
export type AmfeSheetColumnAggregation = "sum" | "mean";

/**
 * Estatística lida de uma coluna da planilha que a análise multicritério já usa
 * (aba de dados, uma linha por município e uma coluna por critério).
 *
 * Não existe eixo de tempo nessa planilha: cada coluna é uma foto só. Por isso
 * a fonte carrega um `periodKey` único, escolhido no catálogo, que é o rótulo
 * do período sob o qual o valor é publicado — o painel continua tendo um
 * período, e ele é sempre este.
 *
 * @example
 * const source: AmfeSheetColumnStatisticsSource = {
 *   kind: "amfe-sheet-column",
 *   column: "ips",
 *   periodKey: "2024",
 *   aggregation: "mean",
 * };
 */
export interface AmfeSheetColumnStatisticsSource {
  kind: typeof AMFE_SHEET_COLUMN_KIND;
  /** Nome exato da coluna do critério na aba de dados da planilha. */
  column: string;
  /** Ano único exibido em Monitoramento, no formato `YYYY`. */
  periodKey: string;
  aggregation: AmfeSheetColumnAggregation;
}

const PERIOD_KEY_PATTERN = /^\d{4}$/u;

export function isAmfeSheetColumnSource(
  value: unknown,
): value is AmfeSheetColumnStatisticsSource {
  return isGeeStatisticsRecord(value) && value.kind === AMFE_SHEET_COLUMN_KIND;
}

export function parseAmfeSheetColumnSource(
  value: unknown,
): AmfeSheetColumnStatisticsSource {
  if (!isAmfeSheetColumnSource(value)) {
    throw new Error(
      "A fonte estatística deve ser uma coluna da planilha da análise multicritério.",
    );
  }

  const column = typeof value.column === "string" ? value.column.trim() : "";
  if (!column) {
    throw new Error(
      "Escolha a coluna da planilha que dá o valor de cada município.",
    );
  }

  const periodKey =
    typeof value.periodKey === "string" ? value.periodKey.trim() : "";
  // A planilha não tem eixo de tempo, mas o painel tem: sem um ano escrito aqui
  // a camada nasceria sem período e o Monitoramento não teria o que selecionar.
  if (!PERIOD_KEY_PATTERN.test(periodKey)) {
    throw new Error(
      `Informe o ano de exibição com quatro dígitos (ex.: 2024); recebido: ${periodKey || "(vazio)"}.`,
    );
  }

  if (value.aggregation !== "sum" && value.aggregation !== "mean") {
    throw new Error(
      "A agregação territorial deve ser soma ou média dos municípios.",
    );
  }

  return {
    kind: AMFE_SHEET_COLUMN_KIND,
    column,
    periodKey,
    aggregation: value.aggregation,
  };
}
