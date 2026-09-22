import {
  catalogErrorResponse,
  noStoreJson,
  readJsonBody,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";
import { parseMunicipalSpreadsheetSource } from "@/contracts/municipalSpreadsheet";
import { readSpreadsheetClassificationSample } from "@/services/indexCatalog/spreadsheetClassificationSample";

const PERIOD_PATTERN = /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/u;

function parsePeriod(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const period = String(value).trim();
  if (!PERIOD_PATTERN.test(period)) {
    throw new Error(`Período inválido: ${period}. Use AAAA ou AAAA-MM.`);
  }
  return period;
}

/**
 * A distribuição de valores de uma planilha que ainda está no formulário.
 *
 * Existe ao lado da rota por rascunho (`drafts/[entryId]/classification-sample`)
 * porque um índice de planilha tem os valores no próprio link colado: o bloco
 * de faixas funciona antes de salvar e antes de validar, como o antigo botão
 * "Detectar faixas da planilha" já funcionava. As demais formas dependem do
 * asset do Earth Engine gravado no rascunho e continuam na rota por entry.
 *
 * Não escreve nada: a resposta preenche o formulário. Mesmo assim exige origem
 * confiável, porque dispara a leitura de um arquivo do Drive.
 */
export async function POST(request: Request) {
  const access = await requireCatalogAccess(request, { mutation: true });
  if ("response" in access) return access.response;

  try {
    const body = await readJsonBody(request);
    const sample = await readSpreadsheetClassificationSample(
      parseMunicipalSpreadsheetSource(body.source),
      parsePeriod(body.period),
    );
    return noStoreJson({ sample });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
