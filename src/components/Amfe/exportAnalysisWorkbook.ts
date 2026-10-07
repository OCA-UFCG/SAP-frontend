import type * as XlsxNamespace from "xlsx";
import type { AnalyzePayload, Cities } from "@/utils/amfeInterfaces";
import {
  buildAnalysisParameters,
  type ReportTranslator,
} from "./analysisReportModel";

/** O módulo `xlsx` é carregado sob demanda; ver downloadAnalysisWorkbook. */
export type XlsxModule = typeof XlsxNamespace;

/** Tradutor do namespace `Map`, injetado para manter este módulo sem React. */
export type WorkbookTranslator = ReportTranslator;

type SpecRow = Record<string, string | number | boolean>;

const buildDataRows = (cities: Cities) =>
  Object.entries(cities).map(([cityId, city]) => ({ city_id: cityId, ...city }));

const buildSpecRows = (
  payload: AnalyzePayload,
  t: WorkbookTranslator,
): SpecRow[] =>
  buildAnalysisParameters(payload, t).map((parameter) => ({
    [t("secaoCol")]: parameter.section,
    [t("parametroCol")]: parameter.label,
    [t("valorCol")]: parameter.value,
    [t("observacaoCol")]: parameter.note,
  }));

/**
 * Monta a planilha da análise: uma aba com o resultado por município e outra
 * com os parâmetros que o geraram, para que o arquivo seja reproduzível sem
 * depender da tela onde foi exportado.
 *
 * @example
 * const workbook = buildAnalysisWorkbook(await import("xlsx"), cities, payload, t);
 */
export const buildAnalysisWorkbook = (
  xlsx: XlsxModule,
  cities: Cities,
  payload: AnalyzePayload,
  t: WorkbookTranslator,
): XlsxNamespace.WorkBook => {
  const workbook = xlsx.utils.book_new();

  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.json_to_sheet(buildDataRows(cities)),
    t("dadosSheet"),
  );

  const specSheet = xlsx.utils.json_to_sheet(buildSpecRows(payload, t));
  specSheet["!cols"] = [{ wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 14 }];

  xlsx.utils.book_append_sheet(workbook, specSheet, t("especificacoesSheet"));

  return workbook;
};

/**
 * Dispara o download da planilha no browser. O `xlsx` pesa ~2 MB no bundle e
 * só é necessário aqui, então entra por import dinâmico: quem abre a tela sem
 * exportar nunca o baixa.
 */
export const downloadAnalysisWorkbook = async (
  cities: Cities,
  payload: AnalyzePayload,
  t: WorkbookTranslator,
  fileName = "analise.xlsx",
) => {
  const xlsx = await import("xlsx");

  xlsx.writeFile(buildAnalysisWorkbook(xlsx, cities, payload, t), fileName);
};
