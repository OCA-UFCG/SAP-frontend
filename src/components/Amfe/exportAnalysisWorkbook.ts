import type * as XlsxNamespace from "xlsx";
import type { AnalyzePayload, Cities } from "@/utils/amfeInterfaces";

/** O módulo `xlsx` é carregado sob demanda; ver downloadAnalysisWorkbook. */
export type XlsxModule = typeof XlsxNamespace;

/** Tradutor do namespace `Map`, injetado para manter este módulo sem React. */
export type WorkbookTranslator = (key: string) => string;

type SpecRow = Record<string, string | number | boolean>;

const buildDataRows = (cities: Cities) =>
  Object.entries(cities).map(([cityId, city]) => ({ city_id: cityId, ...city }));

const buildCriteriaRows = (
  { criteria }: AnalyzePayload,
  t: WorkbookTranslator,
): SpecRow[] =>
  criteria.map((criterion, index) => ({
    [t("secaoCol")]: index === 0 ? t("criterios") : "",
    [t("parametroCol")]: criterion.name,
    [t("valorCol")]: criterion.value,
    [t("observacaoCol")]: criterion.is_benefit ? t("beneficio") : t("custo"),
  }));

const buildThresholdRows = (
  { thresholds }: AnalyzePayload,
  t: WorkbookTranslator,
): SpecRow[] => [
  {
    [t("secaoCol")]: t("limiares"),
    [t("parametroCol")]: t("indiferenca"),
    [t("valorCol")]: thresholds.indifference,
    [t("observacaoCol")]: "",
  },
  {
    [t("secaoCol")]: "",
    [t("parametroCol")]: t("preferencia"),
    [t("valorCol")]: thresholds.preference,
    [t("observacaoCol")]: "",
  },
  {
    [t("secaoCol")]: "",
    [t("parametroCol")]: t("veto"),
    [t("valorCol")]: thresholds.veto,
    [t("observacaoCol")]: "",
  },
];

const buildSettingsRows = (
  payload: AnalyzePayload,
  t: WorkbookTranslator,
): SpecRow[] => [
  {
    [t("secaoCol")]: t("cenario"),
    [t("parametroCol")]: t("tipo"),
    [t("valorCol")]:
      payload.typeScenario === "optimistic" ? t("otimista") : t("pessimista"),
    [t("observacaoCol")]: "",
  },
  {
    [t("secaoCol")]: t("ranking"),
    [t("parametroCol")]: t("nivel"),
    [t("valorCol")]: payload.ranking.level,
    [t("observacaoCol")]: "",
  },
  {
    [t("secaoCol")]: t("interestArea"),
    [t("parametroCol")]: t("interestAreaValue"),
    [t("valorCol")]: payload.interestArea.value,
    [t("observacaoCol")]: "",
  },
  {
    [t("secaoCol")]: t("modelo"),
    [t("parametroCol")]: t("versao"),
    [t("valorCol")]: payload.model.version,
    [t("observacaoCol")]: "",
  },
];

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

  const specSheet = xlsx.utils.json_to_sheet([
    ...buildCriteriaRows(payload, t),
    ...buildThresholdRows(payload, t),
    ...buildSettingsRows(payload, t),
  ]);
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
