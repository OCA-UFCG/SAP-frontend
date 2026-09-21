import "server-only";

import type { MunicipalSpreadsheetStatisticsSource } from "@/contracts/municipalSpreadsheet";
import type { MunicipalSpreadsheetSnapshot } from "@/contracts/municipalSpreadsheetSnapshot";
import { getDraftSpreadsheetSnapshot } from "@/services/indexCatalog/draftSpreadsheetSnapshot";
import type { SpreadsheetSnapshotReaderDependencies } from "@/services/indexCatalog/spreadsheetSnapshotReader";
import type { MunicipalValueIndicator } from "@/types/indexCatalog";
import {
  detectValueLegend,
  type DetectedValueLegend,
} from "@/utils/spreadsheetLegendDetection";

/** Chave territorial de município: sete dígitos do código do IBGE. */
const MUNICIPALITY_KEY_PATTERN = /^\d{7}$/u;

export interface DetectedSpreadsheetLegend extends DetectedValueLegend {
  /** O período sobre o qual as faixas foram calculadas. */
  periodKey: string;
}

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
): number[] {
  return Object.entries(snapshot.values)
    .filter(([locationKey]) => MUNICIPALITY_KEY_PATTERN.test(locationKey))
    .map(([, values]) => values[position])
    .filter((value): value is number => value !== null);
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
      "A planilha não tem nenhuma coluna de período para detectar as faixas.",
    );
  }
  return { periodKey, position: snapshot.periods.indexOf(periodKey) };
}

/**
 * Lê a planilha e devolve as faixas de cor que descrevem a distribuição dela.
 *
 * Reaproveita o instantâneo que a validação e a prévia já guardaram em
 * memória, então detectar faixas depois de validar não custa outra ida ao
 * Google Drive. Não grava nada: o resultado vai para o formulário, e é o
 * operador quem decide validar com ele, ajustar ou ignorar.
 *
 * @example
 * const legend = await detectSpreadsheetLegend({ source, indicator });
 * legend.thresholds; // [120, 480, 1500, 6200]
 */
export async function detectSpreadsheetLegend(
  {
    source,
    indicator,
    rangeCount,
    periodKey,
  }: {
    source: MunicipalSpreadsheetStatisticsSource;
    indicator: MunicipalValueIndicator;
    rangeCount?: number;
    periodKey?: string;
  },
  dependencies: SpreadsheetSnapshotReaderDependencies = {},
): Promise<DetectedSpreadsheetLegend> {
  const snapshot = await getDraftSpreadsheetSnapshot(source, dependencies);
  const period = resolvePeriodPosition(snapshot, periodKey);
  const values = selectMunicipalValues(snapshot, period.position);

  return {
    periodKey: period.periodKey,
    ...detectValueLegend(values, indicator, rangeCount),
  };
}
