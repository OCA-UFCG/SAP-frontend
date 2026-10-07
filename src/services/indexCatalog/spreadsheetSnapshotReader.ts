import "server-only";

import type { MunicipalSpreadsheetStatisticsSource } from "@/contracts/municipalSpreadsheet";
import type { MunicipalSpreadsheetSnapshot } from "@/contracts/municipalSpreadsheetSnapshot";
import { readGoogleSpreadsheet } from "@/infrastructure/google-drive/spreadsheetReader";
import { hashCatalogValue } from "@/services/indexCatalog/catalogFingerprint";
import type { CatalogValidationIssue } from "@/types/indexCatalog";
import { aggregateMunicipalSpreadsheet } from "@/utils/municipalSpreadsheetAggregation";
import {
  assertSpreadsheetColumns,
  readMunicipalSpreadsheetRows,
  resolveSpreadsheetPeriodColumns,
  type AmbiguousDecimalColumn,
} from "@/utils/municipalSpreadsheetTable";

export interface SpreadsheetSnapshotReaderDependencies {
  readSpreadsheet?: typeof readGoogleSpreadsheet;
}

export interface SpreadsheetSnapshotReading {
  periods: string[];
  municipalityCount: number;
  snapshot: MunicipalSpreadsheetSnapshot;
  /** Resume os valores agregados, que é o que muda o índice publicado. */
  snapshotRevision: string;
  warnings: CatalogValidationIssue[];
}

function describeAmbiguousColumns(
  columns: readonly AmbiguousDecimalColumn[],
): CatalogValidationIssue[] {
  if (columns.length === 0) return [];
  const described = columns
    .map(({ column, sample }) => `${column} (ex.: "${sample}")`)
    .join(", ");
  return [
    {
      code: "spreadsheet_ambiguous_decimal",
      message: `Não deu para decidir o que o ponto separa em ${described}: "1.046" tanto pode ser 1046 quanto 1,046. Li como decimal. Se o certo for milhar, formate a coluna como número na planilha em vez de texto.`,
    },
  ];
}

function buildWarnings(
  missingByPeriod: Record<string, number>,
  unknownStateCount: number,
  municipalityCount: number,
  ambiguousDecimalColumns: readonly AmbiguousDecimalColumn[],
): CatalogValidationIssue[] {
  const incomplete = Object.entries(missingByPeriod).filter(
    ([, missing]) => missing > 0,
  );
  return [
    ...(incomplete.length > 0
      ? [
          {
            code: "spreadsheet_missing_values",
            message: `A planilha tem municípios sem valor: ${incomplete
              .map(([period, missing]) => `${period} (${missing})`)
              .join(
                ", ",
              )}. Eles aparecem como "sem dado" no mapa e ficam fora das somas dos territórios maiores.`,
          },
        ]
      : []),
    ...(unknownStateCount > 0
      ? [
          {
            code: "spreadsheet_unknown_state",
            message: `${unknownStateCount} de ${municipalityCount} municípios têm UF que não reconheci em SIGLA_UF/NM_UF; eles ficam fora do ranking de estados.`,
          },
        ]
      : []),
    ...describeAmbiguousColumns(ambiguousDecimalColumns),
  ];
}

/**
 * Lê a planilha do Google e agrega todos os recortes territoriais.
 *
 * Não escreve nada: o instantâneo volta em memória, e quem decide gravá-lo no
 * Contentful é a publicação. Validar um índice não pode tocar no arquivo que a
 * produção está lendo — inclusive porque a publicação revalida antes de
 * comparar a impressão digital e pode recusar o que acabou de ler.
 *
 * @example
 * const reading = await readSpreadsheetSnapshot(source);
 * reading.snapshot.values["2507507"]; // [12345, null]
 */
export async function readSpreadsheetSnapshot(
  source: MunicipalSpreadsheetStatisticsSource,
  {
    readSpreadsheet = readGoogleSpreadsheet,
  }: SpreadsheetSnapshotReaderDependencies = {},
): Promise<SpreadsheetSnapshotReading> {
  const table = await readSpreadsheet(source.fileId);
  const periodColumns = resolveSpreadsheetPeriodColumns(
    table.header,
    source.valuePrefix,
  );
  assertSpreadsheetColumns(table.header, periodColumns, source.valuePrefix);

  const periods = periodColumns.map((column) => column.periodKey);
  const { rows, ambiguousDecimalColumns } = readMunicipalSpreadsheetRows(
    table.header,
    table.rows,
    periodColumns,
  );
  if (rows.length === 0) {
    throw new Error(
      `A planilha ${source.fileId} não tem nenhuma linha com código de município em CD_MUN.`,
    );
  }

  const aggregated = aggregateMunicipalSpreadsheet(
    rows,
    periods,
    source.aggregation,
  );

  return {
    periods,
    municipalityCount: rows.length,
    snapshot: aggregated.snapshot,
    snapshotRevision: hashCatalogValue(aggregated.snapshot.values),
    warnings: buildWarnings(
      aggregated.missingByPeriod,
      aggregated.unknownStateCount,
      rows.length,
      ambiguousDecimalColumns,
    ),
  };
}
