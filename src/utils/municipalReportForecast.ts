import type {
  MunicipalReportAnalysis,
  MunicipalReportForecastFacets,
} from "@/contracts/municipalReport";
import { stableMunicipalReportAlias } from "@/utils/municipalReport";
import { resolveReportCategoryKey } from "@/utils/municipalReportCategories";

/**
 * As previsões climáticas são o mesmo produto repetido por tipo: a Anomalia, o
 * Acumulado e a Probabilidade da precipitação do INMET são três camadas, e no
 * relatório viravam três seções quase iguais, cada uma com o seu cabeçalho,
 * mapa e notas. Aqui as análises com a mesma fonte, variável e periodicidade
 * viram uma seção só, com um painel por tipo.
 */

export interface ReportForecastGroup {
  /** Âncora da seção, no lugar do alias de uma análise. */
  alias: string;
  source: string;
  variable: string;
  periodicity: MunicipalReportForecastFacets["periodicity"];
  category?: string;
  /**
   * `true` quando o mesmo relatório tem a mesma fonte e variável em outra
   * periodicidade: sem ela no título, o sumário teria duas linhas iguais.
   */
  showPeriodicity: boolean;
  /** Um por tipo, na ordem Anomalia, Acumulado, Probabilidade e o resto. */
  members: MunicipalReportAnalysis[];
}

export type ReportDocumentSection =
  | { type: "analysis"; analysis: MunicipalReportAnalysis }
  | { type: "forecast"; group: ReportForecastGroup };

const KIND_ORDER = ["anomalia", "acumulado", "probabilidade"];

function kindRank(kind: string) {
  const index = KIND_ORDER.indexOf(stableMunicipalReportAlias(kind));
  return index === -1 ? KIND_ORDER.length : index;
}

function compareKinds(left: string, right: string) {
  return kindRank(left) - kindRank(right) || left.localeCompare(right, "pt-BR");
}

const PERIODICITY_ORDER = ["monthly", "quarterly"];

/** Variável, depois mensal antes de trimestral, depois fonte. */
function compareForecastGroups(
  left: ReportForecastGroup,
  right: ReportForecastGroup,
) {
  return (
    left.variable.localeCompare(right.variable, "pt-BR") ||
    PERIODICITY_ORDER.indexOf(left.periodicity) -
      PERIODICITY_ORDER.indexOf(right.periodicity) ||
    left.source.localeCompare(right.source, "pt-BR")
  );
}

function forecastGroupAlias(
  facets: Omit<MunicipalReportForecastFacets, "kind">,
) {
  return stableMunicipalReportAlias(
    `previsao ${facets.source} ${facets.variable} ${facets.periodicity}`,
  );
}

/**
 * O nome e a fonte de um índice publicado em mais de uma fonte, como
 * "Índice de Aridez - ERA5 Land". `null` quando o título não tem essa forma.
 *
 * @example
 * splitReportAnalysisTitle("Índice de Aridez - BR-DWGD");
 * // { name: "Índice de Aridez", variant: "BR-DWGD" }
 */
export function splitReportAnalysisTitle(title: string) {
  const match = /^(.+?)\s+-\s+(.+)$/u.exec(title);
  return match ? { name: match[1].trim(), variant: match[2].trim() } : null;
}

/** A chave que junta as fontes do mesmo índice ("indice_de_aridez"). */
export function reportAnalysisFamilyKey(analysis: MunicipalReportAnalysis) {
  const parts = splitReportAnalysisTitle(analysis.title);
  return parts ? stableMunicipalReportAlias(parts.name) : null;
}

/**
 * As fontes do mesmo índice lado a lado, na posição da primeira: no sumário
 * elas viram subtópicos de uma linha só, e os números de página precisam
 * continuar crescendo.
 */
function keepFamiliesTogether<T extends { analysis: MunicipalReportAnalysis }>(
  sections: readonly T[],
) {
  const ordered: T[] = [];
  for (const section of sections) {
    if (ordered.includes(section)) continue;
    ordered.push(section);
    const key = reportAnalysisFamilyKey(section.analysis);
    if (!key) continue;
    ordered.push(
      ...sections.filter(
        (other) =>
          other !== section &&
          !ordered.includes(other) &&
          reportAnalysisFamilyKey(other.analysis) === key,
      ),
    );
  }
  return ordered;
}

/**
 * As seções do documento, na ordem das análises, com as previsões juntas no fim
 * da sua categoria — no sumário elas ficam sob uma linha só, "Previsão
 * climática". Entre si, as previsões ficam por variável, periodicidade e fonte
 * (Precipitação mensal CPTEC, INMET; Precipitação trimestral CPTEC, INMET;
 * Temperatura...).
 *
 * @example
 * buildReportDocumentSections([anomaliaInmet, seca, acumuladoInmet]);
 * // [{ type: "analysis", analysis: seca },
 * //  { type: "forecast", group: { members: [anomaliaInmet, acumuladoInmet] } }]
 */
export function buildReportDocumentSections(
  analyses: readonly MunicipalReportAnalysis[],
): ReportDocumentSection[] {
  const sections: ReportDocumentSection[] = [];
  const groups = new Map<string, ReportForecastGroup>();

  for (const analysis of analyses) {
    const forecast = analysis.forecast;
    if (!forecast) {
      sections.push({ type: "analysis", analysis });
      continue;
    }

    const alias = forecastGroupAlias(forecast);
    const existing = groups.get(alias);
    if (existing) {
      existing.members.push(analysis);
      continue;
    }

    const group: ReportForecastGroup = {
      alias,
      source: forecast.source,
      variable: forecast.variable,
      periodicity: forecast.periodicity,
      ...(analysis.category ? { category: analysis.category } : {}),
      showPeriodicity: false,
      members: [analysis],
    };
    groups.set(alias, group);
    sections.push({ type: "forecast", group });
  }

  const all = [...groups.values()];
  for (const group of all) {
    group.members.sort((left, right) =>
      compareKinds(left.forecast!.kind, right.forecast!.kind),
    );
    group.showPeriodicity = all.some(
      (other) =>
        other !== group &&
        stableMunicipalReportAlias(other.source) ===
          stableMunicipalReportAlias(group.source) &&
        stableMunicipalReportAlias(other.variable) ===
          stableMunicipalReportAlias(group.variable),
    );
  }

  // As análises chegam agrupadas por categoria; cada categoria sai com as
  // análises comuns primeiro e as previsões dela, em ordem, logo depois.
  const byCategory = new Map<string, ReportDocumentSection[]>();
  for (const section of sections) {
    const key = resolveReportCategoryKey(
      section.type === "analysis"
        ? section.analysis.category
        : section.group.category,
    );
    const current = byCategory.get(key);
    if (current) current.push(section);
    else byCategory.set(key, [section]);
  }

  return [...byCategory.values()].flatMap((category) => [
    ...keepFamiliesTogether(
      category.flatMap((section) =>
        section.type === "analysis" ? [section] : [],
      ),
    ),
    ...category
      .flatMap((section) => (section.type === "forecast" ? [section] : []))
      .sort((left, right) => compareForecastGroups(left.group, right.group)),
  ]);
}

/**
 * O período que a seção descreve: o mais comum entre os tipos com dado, e,
 * no empate, o mais recente. Os tipos saem da mesma rodada do modelo e
 * costumam concordar; quando um deles não tem o período, o painel dele diz
 * qual mostra.
 */
export function resolveForecastGroupPeriod(group: ReportForecastGroup) {
  const counts = new Map<string, number>();
  for (const member of group.members) {
    const period = member.effectivePeriod ?? member.snapshot?.period;
    if (period) counts.set(period, (counts.get(period) ?? 0) + 1);
  }

  let chosen: string | null = null;
  for (const [period, count] of counts) {
    const best = chosen ? counts.get(chosen)! : 0;
    if (count > best || (count === best && chosen && period > chosen)) {
      chosen = period;
    }
  }

  return chosen ?? group.members[0]?.requestedPeriod ?? null;
}

/** Todos os períodos que algum tipo do grupo publicou, em ordem. */
export function listForecastGroupPeriods(group: ReportForecastGroup) {
  return [
    ...new Set(
      group.members.flatMap((member) =>
        member.timeSeries.map(({ period }) => period),
      ),
    ),
  ].sort((left, right) => left.localeCompare(right));
}
