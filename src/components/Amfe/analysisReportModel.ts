import { CLASSIFICATION_COLORS } from "@/components/Map/classificationLayers";
import type {
  AnalysisCoverage,
  AnalysisLevel,
  AnalyzePayload,
  Cities,
  ExcludedCities,
  interestArea,
} from "@/utils/amfeInterfaces";

/**
 * Tradutor do namespace `Map`, injetado para manter este módulo sem React.
 * Aceita valores porque o relatório interpola contagens; uma função só de
 * chave continua atribuível, então o `WorkbookTranslator` segue servindo.
 */
export type ReportTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

/** Uma linha da descrição da análise, independente de onde for desenhada. */
export interface ReportParameter {
  section: string;
  label: string;
  value: string | number;
  note: string;
}

/**
 * Os parâmetros que descrevem uma análise, na ordem em que são lidos. A
 * planilha e o relatório partem daqui para que um limiar novo só precise ser
 * declarado uma vez.
 */
export const buildAnalysisParameters = (
  payload: AnalyzePayload,
  t: ReportTranslator,
): ReportParameter[] => [
  ...payload.criteria.map((criterion, index) => ({
    section: index === 0 ? t("criterios") : "",
    label: criterion.name,
    value: criterion.value,
    note: criterion.is_benefit ? t("beneficio") : t("custo"),
  })),
  {
    section: t("limiares"),
    label: t("indiferenca"),
    value: payload.thresholds.indifference,
    note: "",
  },
  {
    section: "",
    label: t("preferencia"),
    value: payload.thresholds.preference,
    note: "",
  },
  { section: "", label: t("veto"), value: payload.thresholds.veto, note: "" },
  {
    section: t("cenario"),
    label: t("tipo"),
    value:
      payload.typeScenario === "optimistic" ? t("otimista") : t("pessimista"),
    note: "",
  },
  {
    section: t("ranking"),
    label: t("nivel"),
    value: payload.ranking.level,
    note: "",
  },
  {
    section: t("interestArea"),
    label: t("interestAreaValue"),
    value: payload.interestArea.value,
    note: "",
  },
  {
    section: t("modelo"),
    label: t("versao"),
    value: payload.model.version,
    note: "",
  },
];

/** Uma linha da tabela de critérios do relatório, com rótulo já legível. */
export interface ReportCriterion {
  label: string;
  weight: number;
  direction: string;
}

/** Uma linha da tabela de limiares do relatório. */
export interface ReportThreshold {
  label: string;
  value: number;
}

/**
 * Critérios do payload com o rótulo do catálogo (`criteriaLabels`). Um nome
 * fora do catálogo cai no próprio `name` — a tabela nunca fica com célula
 * vazia por causa de um critério que o catálogo ainda não conhece.
 */
const buildReportCriteria = (
  payload: AnalyzePayload,
  criteriaLabels: Record<string, string>,
  t: ReportTranslator,
): ReportCriterion[] =>
  payload.criteria.map((criterion) => ({
    label: criteriaLabels[criterion.name] ?? criterion.name,
    weight: criterion.value,
    direction: criterion.is_benefit ? t("beneficio") : t("custo"),
  }));

const buildReportThresholds = (
  payload: AnalyzePayload,
  t: ReportTranslator,
): ReportThreshold[] => [
  { label: t("indiferenca"), value: payload.thresholds.indifference },
  { label: t("preferencia"), value: payload.thresholds.preference },
  { label: t("veto"), value: payload.thresholds.veto },
];

const buildReportScenario = (
  payload: AnalyzePayload,
  t: ReportTranslator,
): string =>
  payload.typeScenario === "optimistic" ? t("otimista") : t("pessimista");

/** Acima disto, a lista aponta a planilha em vez de continuar. */
export const REPORT_LIST_LIMIT = 30;

const PRIORITY_LABEL_KEYS = [
  "priorityVeryLow",
  "priorityLow",
  "priorityMedium",
  "priorityHigh",
  "priorityVeryHigh",
] as const;

const TOP_PRIORITY_LEVEL = PRIORITY_LABEL_KEYS.length - 1;

export interface DistributionClass {
  level: number;
  label: string;
  color: string;
  count: number;
  share: number;
}

export interface ReportCity {
  name: string;
  uf: string;
}

export interface ReportExcludedCity {
  name: string;
}

export interface CappedList<T> {
  shown: T[];
  remaining: number;
  total: number;
}

export interface ReportScope {
  area: string;
  value: string;
  level: string;
}

export interface AnalysisReportModel {
  generatedAt: Date;
  criteria: ReportCriterion[];
  thresholds: ReportThreshold[];
  scenario: string;
  modelVersion: string;
  scope: ReportScope;
  coverage: { analyzed: number; total: number; excluded: number } | null;
  distribution: DistributionClass[];
  topPriority: CappedList<ReportCity>;
  excluded: CappedList<ReportExcludedCity>;
}

const cap = <T>(items: T[]): CappedList<T> => ({
  shown: items.slice(0, REPORT_LIST_LIMIT),
  remaining: Math.max(0, items.length - REPORT_LIST_LIMIT),
  total: items.length,
});

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "pt-BR");

/** `interestArea.type` cobre também semiárido e ASD; `ranking.level` não. */
const INTEREST_AREA_SCOPE_KEYS: Record<interestArea, string> = {
  national: "scopeNational",
  state: "scopeState",
  region: "scopeRegion",
  biome: "scopeBiome",
  semiarid: "scopeSemiarid",
  asd: "scopeAsd",
};

const ANALYSIS_LEVEL_SCOPE_KEYS: Record<AnalysisLevel, string> = {
  national: "scopeNational",
  state: "scopeState",
  region: "scopeRegion",
  biome: "scopeBiome",
};

/** Área de interesse e nível do ranking, traduzidos por extenso para o cabeçalho. */
const buildScope = (
  payload: AnalyzePayload,
  t: ReportTranslator,
): ReportScope => ({
  area: t(INTEREST_AREA_SCOPE_KEYS[payload.interestArea.type]),
  value: payload.interestArea.value,
  level: t(ANALYSIS_LEVEL_SCOPE_KEYS[payload.ranking.level]),
});

/**
 * Quantos municípios em cada classe. Uma classificação fora da escala é
 * descartada em silêncio: ela não tem cor no mapa, então também não tem linha
 * aqui — o relatório não deve inventar uma sexta classe.
 */
const buildDistribution = (
  cities: Cities,
  t: ReportTranslator,
): DistributionClass[] => {
  const counts = PRIORITY_LABEL_KEYS.map(() => 0);

  for (const city of Object.values(cities)) {
    if (city.classification >= 0 && city.classification < counts.length) {
      counts[city.classification] += 1;
    }
  }

  const total = counts.reduce((sum, count) => sum + count, 0);

  return counts.map((count, level) => ({
    level,
    label: t(PRIORITY_LABEL_KEYS[level]),
    color: CLASSIFICATION_COLORS[level],
    count,
    share: total === 0 ? 0 : (count / total) * 100,
  }));
};

const buildTopPriority = (cities: Cities): ReportCity[] =>
  Object.values(cities)
    .filter((city) => city.classification === TOP_PRIORITY_LEVEL)
    .map((city) => ({ name: city.name, uf: city.UF ?? "" }))
    .sort(byName);

const buildExcluded = (excludedCities: ExcludedCities): ReportExcludedCity[] =>
  Object.values(excludedCities)
    .map((city) => ({ name: city.name ?? "" }))
    .sort(byName);

/**
 * Tudo o que o relatório desenha, já resolvido em número. `generatedAt` entra
 * por parâmetro para que o teste não dependa do relógio. `criteriaLabels`
 * mapeia nome de critério (chave do backend) para o rótulo legível do
 * catálogo — ver `useCriterias`.
 *
 * @example buildAnalysisReportModel(cities, coverage, excluded, payload, t, criteriaLabels)
 */
export const buildAnalysisReportModel = (
  cities: Cities,
  coverage: AnalysisCoverage | null,
  excludedCities: ExcludedCities,
  payload: AnalyzePayload,
  t: ReportTranslator,
  criteriaLabels: Record<string, string>,
  generatedAt: Date = new Date(),
): AnalysisReportModel => ({
  generatedAt,
  criteria: buildReportCriteria(payload, criteriaLabels, t),
  thresholds: buildReportThresholds(payload, t),
  scenario: buildReportScenario(payload, t),
  modelVersion: payload.model.version,
  scope: buildScope(payload, t),
  coverage: coverage
    ? {
        analyzed: coverage.count,
        total: coverage.totalCount,
        excluded: coverage.excludedCount,
      }
    : null,
  distribution: buildDistribution(cities, t),
  topPriority: cap(buildTopPriority(cities)),
  excluded: cap(buildExcluded(excludedCities)),
});
