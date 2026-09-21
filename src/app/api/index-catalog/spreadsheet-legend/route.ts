import {
  catalogErrorResponse,
  noStoreJson,
  readJsonBody,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";
import { parseMunicipalSpreadsheetSource } from "@/contracts/municipalSpreadsheet";
import { detectSpreadsheetLegend } from "@/services/indexCatalog/spreadsheetLegendService";
import type { MunicipalValueIndicator } from "@/types/indexCatalog";

const MAX_DETECTED_RANGES = 8;

function parseIndicator(value: unknown): MunicipalValueIndicator {
  const indicator = (value ?? {}) as Partial<MunicipalValueIndicator>;
  if (
    indicator.valueType !== "percentage" &&
    indicator.valueType !== "absolute"
  ) {
    throw new Error(
      `Informe o formato do número do indicador (percentual ou contagem); recebido ${JSON.stringify(indicator.valueType)}.`,
    );
  }
  return {
    label: typeof indicator.label === "string" ? indicator.label : "",
    measurementUnit:
      typeof indicator.measurementUnit === "string"
        ? indicator.measurementUnit
        : "",
    color: typeof indicator.color === "string" ? indicator.color : "#1B5E20",
    valueType: indicator.valueType,
  };
}

function parseRangeCount(value: unknown) {
  if (value === undefined || value === null) return undefined;
  const count = Number(value);
  if (!Number.isInteger(count) || count < 2 || count > MAX_DETECTED_RANGES) {
    throw new Error(
      `A quantidade de faixas a detectar deve ser um inteiro entre 2 e ${MAX_DETECTED_RANGES}; recebido ${JSON.stringify(value)}.`,
    );
  }
  return count;
}

/**
 * Detecta as faixas de cor de um índice de planilha a partir dos valores dela.
 *
 * A fonte vem no corpo, e não do rascunho gravado, porque o operador detecta
 * as faixas enquanto preenche o formulário — exigir um salvamento antes faria
 * a tela gravar no Contentful só para responder a um botão de sugestão.
 *
 * Não escreve nada: a resposta preenche o formulário e nada mais. Mesmo assim
 * exige origem confiável, porque dispara a leitura de um arquivo do Drive.
 */
export async function POST(request: Request) {
  const access = await requireCatalogAccess(request, { mutation: true });
  if ("response" in access) return access.response;

  try {
    const body = await readJsonBody(request);
    const legend = await detectSpreadsheetLegend({
      source: parseMunicipalSpreadsheetSource(body.source),
      indicator: parseIndicator(body.indicator),
      rangeCount: parseRangeCount(body.rangeCount),
      periodKey:
        typeof body.periodKey === "string" ? body.periodKey : undefined,
    });

    return noStoreJson(legend);
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
