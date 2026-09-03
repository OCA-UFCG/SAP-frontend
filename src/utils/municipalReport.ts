import type {
  MunicipalReportClass,
  MunicipalReportPeriodSnapshot,
} from "@/contracts/municipalReport";
import type { PublishedPanelLayerReportConfig } from "@/contracts/panelLayerReport";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";
import { resolveNearestReportPeriod } from "@/utils/municipalAvailability";

export function roundReportPercentage(value: number): number {
  return Number(value.toFixed(1));
}

export function buildMunicipalReportSnapshot(
  dataset: CompactTerritorialAnalysisDataset,
  municipalityCode: string,
  period: string,
): MunicipalReportPeriodSnapshot | null {
  const year = dataset.years[period];
  const values = year?.values[municipalityCode];
  if (!year || !values) return null;

  const scale = year.valuesScale ?? 1;
  const distribution = dataset.classes.map((item, index) => ({
    id: item.id,
    label: item.label,
    color: item.color,
    ...(item.tone ? { tone: item.tone } : {}),
    percentage: roundReportPercentage(Number(values[index] ?? 0) / scale),
  }));
  const dominantClass = distribution.length
    ? distribution.reduce((dominant, item) =>
        item.percentage > dominant.percentage ? item : dominant,
      )
    : null;

  return {
    period,
    label: year.year?.trim() || period,
    distribution,
    dominantClass,
  };
}

export function buildMunicipalReportTimeSeries(
  dataset: CompactTerritorialAnalysisDataset,
  municipalityCode: string,
): MunicipalReportPeriodSnapshot[] {
  return Object.keys(dataset.years)
    .sort((left, right) => left.localeCompare(right))
    .flatMap((period) => {
      const snapshot = buildMunicipalReportSnapshot(
        dataset,
        municipalityCode,
        period,
      );
      return snapshot ? [snapshot] : [];
    });
}

export function resolveMunicipalReportSnapshot(
  timeSeries: MunicipalReportPeriodSnapshot[],
  requestedPeriod: string,
): MunicipalReportPeriodSnapshot | null {
  const resolvedPeriod = resolveNearestReportPeriod(
    timeSeries.map((snapshot) => snapshot.period),
    requestedPeriod,
  );

  return resolvedPeriod
    ? (timeSeries.find((snapshot) => snapshot.period === resolvedPeriod) ??
        null)
    : null;
}

export function getMunicipalReportClasses(
  dataset: CompactTerritorialAnalysisDataset,
): MunicipalReportClass[] {
  return dataset.classes.map(({ id, label, color, tone }) => ({
    id,
    label,
    color,
    ...(tone ? { tone } : {}),
  }));
}

/**
 * O apelido de uma camada nas variáveis de template do relatório:
 * `indice-de-aridez` vira `indice_de_aridez`, e a variável, `classe_indice_de_aridez`.
 *
 * Precisa produzir exatamente o mesmo resultado que `normalizeTemplateKey` em
 * `buildDocContent`, senão `[classe]` dentro da seção de uma camada não
 * encontra o valor dela.
 *
 * @example
 * stableMunicipalReportAlias("Índice de Aridez"); // "indice_de_aridez"
 */
export function stableMunicipalReportAlias(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * O que do texto do catálogo é apresentação, e não narrativa: a cor do cabeçalho
 * e a nota de metodologia. Só isso precisa atravessar o contrato do relatório —
 * as seções chegam ao cliente pela rota de textos.
 *
 * @example
 * toMunicipalReportPresentation({ schemaVersion: 1, sections: [], sectionColor: "#795548" });
 * // { sectionColor: "#795548" }
 */
export function toMunicipalReportPresentation(
  reportConfig: PublishedPanelLayerReportConfig | null | undefined,
) {
  if (!reportConfig?.sectionColor && !reportConfig?.methodology)
    return undefined;

  return {
    ...(reportConfig.sectionColor
      ? { sectionColor: reportConfig.sectionColor }
      : {}),
    ...(reportConfig.methodology
      ? { methodology: reportConfig.methodology }
      : {}),
  };
}
