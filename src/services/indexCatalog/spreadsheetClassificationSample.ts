import "server-only";

import type { MunicipalSpreadsheetStatisticsSource } from "@/contracts/municipalSpreadsheet";
import type { MunicipalSpreadsheetSnapshot } from "@/contracts/municipalSpreadsheetSnapshot";
import { getDraftSpreadsheetSnapshot } from "@/services/indexCatalog/draftSpreadsheetSnapshot";
import type { SpreadsheetSnapshotReaderDependencies } from "@/services/indexCatalog/spreadsheetSnapshotReader";
import type { DraftClassificationSample } from "@/types/indexCatalog";
import { buildClassificationSample } from "@/utils/classificationSample";

/** Chave territorial de município: sete dígitos do código do IBGE. */
const MUNICIPALITY_KEY_PATTERN = /^\d{7}$/u;

/**
 * Só os municípios entram no cálculo das faixas.
 *
 * O instantâneo guarda também Brasil, UFs, regiões, biomas, ASD e semiárido, e
 * incluí-los puxaria os limites para cima: uma soma estadual é uma ordem de
 * grandeza maior que a de qualquer município dela. O mapa pinta município, e é
 * a distribuição municipal que a legenda precisa descrever.
 */
function selectMunicipalValues(
  snapshot: MunicipalSpreadsheetSnapshot,
  position: number,
): Array<number | null> {
  return Object.entries(snapshot.values)
    .filter(([locationKey]) => MUNICIPALITY_KEY_PATTERN.test(locationKey))
    .map(([, values]) => values[position]);
}

function resolvePeriodPosition(
  snapshot: MunicipalSpreadsheetSnapshot,
  requestedPeriod?: string,
) {
  const periodKey =
    requestedPeriod && snapshot.periods.includes(requestedPeriod)
      ? requestedPeriod
      : snapshot.periods.at(-1);
  if (!periodKey) {
    throw new Error(
      "A planilha não tem nenhuma coluna de período para calcular as faixas.",
    );
  }
  return { periodKey, position: snapshot.periods.indexOf(periodKey) };
}

/**
 * A distribuição de valores municipais de uma planilha num período, para os
 * métodos de classificação calcularem os limites das faixas.
 *
 * A fonte é recebida por parâmetro, e não lida de um rascunho gravado, porque o
 * bloco de faixas roda enquanto o operador preenche o formulário: num índice de
 * planilha o link já basta para ler os valores, e exigir um salvamento antes
 * faria a tela gravar no Contentful só para responder a um botão de sugestão.
 *
 * Sem `requestedPeriod`, lê o período mais recente da planilha — é o que o
 * formulário pede antes de a validação descobrir a lista de períodos.
 *
 * @example
 * await readSpreadsheetClassificationSample(source);
 * // { origin: "spreadsheet", period: "2023", count: 5570, min: 0, ... }
 */
export async function readSpreadsheetClassificationSample(
  source: MunicipalSpreadsheetStatisticsSource,
  requestedPeriod?: string,
  dependencies: SpreadsheetSnapshotReaderDependencies = {},
): Promise<DraftClassificationSample> {
  const snapshot = await getDraftSpreadsheetSnapshot(source, dependencies);
  const period = resolvePeriodPosition(snapshot, requestedPeriod);
  const sample = buildClassificationSample(
    selectMunicipalValues(snapshot, period.position),
  );
  if (!sample) {
    throw new Error(
      `Nenhum município tem valor numérico no período ${period.periodKey}. Confira o prefixo das colunas de dado da planilha.`,
    );
  }
  return { ...sample, origin: "spreadsheet", period: period.periodKey };
}
