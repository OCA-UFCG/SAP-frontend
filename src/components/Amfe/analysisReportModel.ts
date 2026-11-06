import { CLASSIFICATION_COLORS } from "@/components/Map/classificationLayers";
import { statesObj } from "@/utils/constants";
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
  description: string;
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
  {
    label: t("indiferenca"),
    value: payload.thresholds.indifference,
    description: t("reportIndifferenceDescription"),
  },
  {
    label: t("preferencia"),
    value: payload.thresholds.preference,
    description: t("reportPreferenceDescription"),
  },
  {
    label: t("veto"),
    value: payload.thresholds.veto,
    description: t("reportVetoDescription"),
  },
];

/**
 * O nome do cenário e a nota que explica o que ele faz com um município na
 * fronteira entre duas classes. No ELECTRE TRI-B do backend, o pessimista põe
 * esse município na classe de pior desempenho, que aqui é a de maior
 * prioridade.
 */
const buildReportScenario = (
  payload: AnalyzePayload,
  t: ReportTranslator,
): ReportScenario =>
  payload.typeScenario === "optimistic"
    ? { label: t("otimista"), note: t("reportScenarioOptimisticNote") }
    : { label: t("pessimista"), note: t("reportScenarioPessimisticNote") };

const PRIORITY_LABEL_KEYS = [
  "priorityVeryLow",
  "priorityLow",
  "priorityMedium",
  "priorityHigh",
  "priorityVeryHigh",
] as const;

export interface DistributionClass {
  level: number;
  label: string;
  color: string;
  count: number;
  share: number;
}

/** Os municípios de uma classe, para a lista por prioridade. */
export interface ReportClassList {
  level: number;
  label: string;
  color: string;
  cities: string[];
}

export interface ReportScenario {
  label: string;
  note: string;
}

export interface ReportScope {
  place: string;
  level: string;
}

export interface AnalysisReportModel {
  generatedAt: Date;
  criteria: ReportCriterion[];
  thresholds: ReportThreshold[];
  classCount: number;
  classRange: string;
  scenario: ReportScenario;
  modelVersion: string;
  scope: ReportScope;
  coverage: { analyzed: number; total: number; excluded: number } | null;
  /** Da classe de maior prioridade para a de menor, como no relatório. */
  distribution: DistributionClass[];
  classLists: ReportClassList[];
  excluded: string[];
}

const byName = (a: string, b: string) => a.localeCompare(b, "pt-BR");

const ANALYSIS_LEVEL_SCOPE_KEYS: Record<AnalysisLevel, string> = {
  national: "scopeNational",
  state: "scopeState",
  region: "scopeRegion",
  biome: "scopeBiome",
};

/**
 * O lugar analisado como uma pessoa o escreveria: "Paraíba, PB" para um
 * estado, o próprio nome para região e bioma. Semiárido e ASD chegam com
 * valor fixo (`semiarid`, `asd`), então o nome vem da tradução.
 */
const buildPlace = (
  area: { type: interestArea; value: string },
  t: ReportTranslator,
): string => {
  switch (area.type) {
    case "national":
      return t("reportPlaceNational");
    case "state": {
      const name =
        statesObj[area.value.toLowerCase() as keyof typeof statesObj];
      return name ? `${name}, ${area.value}` : area.value;
    }
    case "semiarid":
      return t("scopeSemiarid");
    case "asd":
      return t("scopeAsd");
    default:
      return area.value;
  }
};

/** Lugar analisado e nível do ranking, por extenso para o cabeçalho. */
const buildScope = (
  payload: AnalyzePayload,
  t: ReportTranslator,
): ReportScope => ({
  place: buildPlace(payload.interestArea, t),
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

  return counts
    .map((count, level) => ({
      level,
      label: t(PRIORITY_LABEL_KEYS[level]),
      color: CLASSIFICATION_COLORS[level],
      count,
      share: total === 0 ? 0 : (count / total) * 100,
    }))
    .reverse();
};

/**
 * Todos os municípios de cada classe, sem corte. A sigla do estado só
 * aparece quando o ranking mistura estados: "Santa Luzia" existe na PB, em MG
 * e na BA, mas numa análise da Paraíba ela seria só ruído.
 */
const buildClassLists = (
  cities: Cities,
  distribution: DistributionClass[],
): ReportClassList[] => {
  const all = Object.values(cities);
  const showUf = new Set(all.map((city) => city.UF)).size > 1;
  const nameOf = (city: (typeof all)[number]) =>
    showUf && city.UF ? `${city.name} – ${city.UF}` : city.name;

  return distribution.map(({ level, label, color }) => ({
    level,
    label,
    color,
    cities: all
      .filter((city) => city.classification === level)
      .map(nameOf)
      .sort(byName),
  }));
};

const buildExcluded = (excludedCities: ExcludedCities): string[] =>
  Object.values(excludedCities)
    .map((city) => city.name ?? "")
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
): AnalysisReportModel => {
  const distribution = buildDistribution(cities, t);

  return {
    generatedAt,
    criteria: buildReportCriteria(payload, criteriaLabels, t),
    thresholds: buildReportThresholds(payload, t),
    classCount: PRIORITY_LABEL_KEYS.length,
    classRange: t("reportClassRange", {
      count: PRIORITY_LABEL_KEYS.length,
      lowest: t(PRIORITY_LABEL_KEYS[0]),
      highest: t(PRIORITY_LABEL_KEYS[PRIORITY_LABEL_KEYS.length - 1]),
    }),
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
    distribution,
    classLists: buildClassLists(cities, distribution),
    excluded: buildExcluded(excludedCities),
  };
};
