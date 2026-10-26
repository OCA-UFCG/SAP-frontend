import {
  formatAbsoluteNumber,
  formatPercentageNumber,
  roundToDisplayedDecimals,
} from "@/utils/formatTerritorialNumber";
import citiesIndex from "@/data/citiesIndex.json";
import { statesObj } from "@/utils/constants";
import type { PanelLayerI } from "@/utils/interfaces";
import type {
  AnalysisDistributionItem,
  AnalysisHighlight,
  AnalysisRankingEntry,
  AnalysisRankingGroup,
  AnalysisTone,
  AnalysisYearOption,
  CompactAnalysisClass,
  AnalysisRankingStatus,
  CompactTerritorialAnalysisDataset,
  TerritorialAnalysisViewModel,
  TerritoryRankingState,
} from "@/utils/analysis";
import {
  formatSeasonalPeriodLabel,
  hasSeasonalPeriods,
} from "@/utils/seasonalPeriod";
import {
  getImageDataDefaultYear,
  getImageDataLegend,
  getImageDataYearKeys,
  isCompactImageData,
  resolveImageYearEntry,
} from "@/utils/imageData";

function getImageDataYearLabel(key: string, dataset?: PanelLayerI): string {
  const entry = resolveImageYearEntry(dataset?.imageData, key);
  // Numa camada sazonal o mês da chave é o início de um trimestre, e o rótulo
  // precisa dizer os três meses.
  const seasonalLabel = hasSeasonalPeriods(dataset)
    ? formatSeasonalPeriodLabel(key)
    : null;

  if (seasonalLabel) {
    return seasonalLabel;
  }

  if (entry?.year?.trim()) {
    return entry.year.trim();
  }

  return key === "general" ? "Padrão" : key;
}

const DEFAULT_HIGHLIGHT_TEMPLATE = "Região maioritariamente {label}";
const DEFAULT_SUMMARY_TEMPLATE = "{label} em {name}: {value}.";

const DEFAULT_RANKING_TITLE = "Estados por classificação";
const DEFAULT_RANKING_TOTAL_LABEL = "Estados";
const DEFAULT_MUNICIPAL_RANKING_TITLE = "Municípios por classificação";
const MUNICIPAL_RANKING_TOTAL_LABEL = "Municípios";
const MAX_RANKING_ITEMS = 5;
const municipalitiesByCode = new Map(
  citiesIndex.map((city) => [city.code, city.label]),
);
const statesByKey = new Map(
  Object.entries(statesObj).map(([uf, name]) => [uf.toLowerCase(), name]),
);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/</g, "menor-que")
    .replace(/>/g, "maior-que")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

interface TranslateFunction {
  (key: string, values?: Record<string, string | number | Date>): string;
  has(key: string): boolean;
}

function translate(
  text: string,
  tCaption?: TranslateFunction,
  values?: Record<string, string | number | Date>,
): string {
  if (!tCaption) return text;
  const slug = slugify(text);
  return tCaption.has(`labels.${slug}`)
    ? tCaption(`labels.${slug}`, values)
    : text;
}

function parseHexColor(color: string) {
  const normalized = color.trim().replace("#", "");

  if (!/^(?:[\da-fA-F]{3}|[\da-fA-F]{6})$/.test(normalized)) {
    return null;
  }

  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => character + character)
          .join("")
      : normalized;

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function buildDefaultAnalysisTone(color: string): AnalysisTone {
  const rgb = parseHexColor(color);

  if (!rgb) {
    return {
      bg: "#F5F5F5",
      color,
      border: color,
    };
  }

  return {
    bg: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`,
    color,
    border: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`,
  };
}

function getCompactClassTone(compactClass: CompactAnalysisClass): AnalysisTone {
  return compactClass.tone ?? buildDefaultAnalysisTone(compactClass.color);
}

function formatTemplate(
  template: string,
  replacements: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    return replacements[token] ?? "";
  });
}

function formatCompactValue(
  data: CompactTerritorialAnalysisDataset,
  value: number,
): string {
  return data.valueConfig?.type === "absolute"
    ? formatAbsoluteNumber(value, "pt-BR")
    : formatPercentageNumber(value, "pt-BR");
}

function formatCompactValueWithUnit(
  data: CompactTerritorialAnalysisDataset,
  value: number,
): string {
  const formatted = formatCompactValue(data, value);
  const unit =
    data.valueConfig?.unit ??
    (data.valueConfig?.type === "absolute" ? "" : "%");

  if (!unit) return formatted;
  return unit === "%" ? `${formatted}%` : `${formatted} ${unit}`;
}

function getLocationSummaryTemplate(
  data: CompactTerritorialAnalysisDataset,
  locationKey: string,
): string | undefined {
  if (locationKey === "br") {
    return data.templates?.country;
  }

  if (isMunicipalityLocationKey(locationKey)) {
    return data.templates?.municipality ?? data.templates?.state;
  }

  return data.templates?.state;
}

function buildCompactDistributionItems(
  data: CompactTerritorialAnalysisDataset,
  locationKey: string,
  yearKey: string,
  tCaption?: TranslateFunction,
): AnalysisDistributionItem[] {
  const yearData = data.years[yearKey];
  const values = yearData?.values[locationKey];

  if (!yearData || !values) {
    return [];
  }

  const scale = yearData.valuesScale ?? 1;

  return data.classes.map((item, index) => ({
    id: item.id,
    label: translate(item.label, tCaption),
    color: item.color,
    value: roundToDisplayedDecimals(((values[index] ?? 0) as number) / scale),
  }));
}

function getDominantDistributionItem(
  items: AnalysisDistributionItem[],
): AnalysisDistributionItem | null {
  if (items.length === 0) {
    return null;
  }

  return items.reduce((max, current) =>
    current.value > max.value ? current : max,
  );
}

function getCompactLocationName(
  data: CompactTerritorialAnalysisDataset,
  locationKey: string,
): string {
  return (
    data.locations?.[locationKey] ??
    getFallbackAnalysisLocationName(locationKey)
  );
}

function isMunicipalityLocationKey(locationKey: string): boolean {
  return /^\d{7}$/.test(locationKey);
}

function isStateLocationKey(locationKey: string): boolean {
  return statesByKey.has(locationKey.toLowerCase());
}

export function getFallbackAnalysisLocationName(locationKey: string): string {
  if (locationKey === "br") {
    return "Brasil";
  }

  if (isMunicipalityLocationKey(locationKey)) {
    return municipalitiesByCode.get(locationKey) ?? locationKey;
  }

  if (locationKey.includes("_")) {
    const parts = locationKey.split("-");
    if (parts.length > 1) {
      const nameSlug = parts.slice(1).join("-");
      return nameSlug
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }
  }

  return statesByKey.get(locationKey.toLowerCase()) ?? locationKey;
}

function getCompactAnalysisDataset(
  dataset: PanelLayerI | undefined,
  effectiveYear: string | null,
): CompactTerritorialAnalysisDataset | null {
  if (!dataset?.imageData || !effectiveYear) {
    return null;
  }

  if (isCompactImageData(dataset.imageData)) {
    return dataset.imageData;
  }

  const analysis = resolveImageYearEntry(
    dataset.imageData,
    effectiveYear,
  )?.analysis;

  if (
    !analysis ||
    analysis.type !== "territorial" ||
    !analysis.data ||
    analysis.data.type !== "territorial-compact"
  ) {
    return null;
  }

  return analysis.data;
}

function buildCompactHighlight(
  data: CompactTerritorialAnalysisDataset,
  dominant: AnalysisDistributionItem | null,
  name: string,
  locationKey: string,
  tCaption?: TranslateFunction,
): AnalysisHighlight | null {
  if (!dominant) {
    return null;
  }

  const compactClass = data.classes.find((item) => item.id === dominant.id);

  if (!compactClass) {
    return null;
  }

  const translatedLabel = translate(compactClass.label, tCaption);
  const tone = getCompactClassTone(compactClass);

  if (data.classes.length === 1) {
    const summaryTemplate = getLocationSummaryTemplate(data, locationKey);
    const values = {
      name,
      label: translatedLabel,
      value: summaryTemplate
        ? formatCompactValue(data, dominant.value)
        : formatCompactValueWithUnit(data, dominant.value),
    };

    return {
      label: translatedLabel,
      text: formatTemplate(
        translate(
          summaryTemplate ?? DEFAULT_SUMMARY_TEMPLATE,
          tCaption,
          values,
        ),
        values,
      ),
      tone,
    };
  }

  const rawTemplate = data.templates?.highlight ?? DEFAULT_HIGHLIGHT_TEMPLATE;
  const translatedTemplate = translate(rawTemplate, tCaption, {
    label: translatedLabel,
  });
  return {
    label: translatedLabel,
    text: formatTemplate(translatedTemplate, { label: translatedLabel }),
    areaShare:
      data.valueConfig?.type === "absolute" ? undefined : dominant.value,
    tone,
  };
}

type RankingSource =
  | { status: Exclude<AnalysisRankingStatus, "ready"> }
  | {
      status: "ready";
      entity: "states" | "municipalities";
      entries: Array<[string, (number | null)[]]>;
      scale: number;
    };

/**
 * De onde sai a lista de "Territórios por classificação" de um recorte.
 *
 * No Brasil os estados já chegam junto com o recorte nacional. Nos demais
 * recortes a lista é buscada à parte (`territoryRanking`), e um município não
 * tem lista.
 */
function resolveRankingSource(
  data: CompactTerritorialAnalysisDataset,
  yearKey: string,
  locationKey: string,
  territoryRanking?: TerritoryRankingState,
): RankingSource {
  if (isMunicipalityLocationKey(locationKey)) {
    return { status: "hidden" };
  }

  if (locationKey === "br") {
    const yearData = data.years[yearKey];

    return {
      status: "ready",
      entity: "states",
      entries: Object.entries(yearData?.values ?? {}).filter(
        ([entryKey]) => entryKey !== "br" && isStateLocationKey(entryKey),
      ),
      scale: yearData?.valuesScale ?? 1,
    };
  }

  if (!territoryRanking || territoryRanking.status === "loading") {
    return { status: "loading" };
  }

  if (territoryRanking.status === "error") {
    return { status: "unavailable" };
  }

  return {
    status: "ready",
    entity: territoryRanking.entity,
    entries: Object.entries(territoryRanking.values),
    scale: 1,
  };
}

/**
 * O título da lista. O catálogo escreve o de estados ("Estados por classe
 * predominante"); numa lista de municípios a primeira palavra é trocada.
 */
function getRawRankingTitle(
  data: CompactTerritorialAnalysisDataset,
  entity: "states" | "municipalities",
): string {
  const statesTitle = data.ranking?.title ?? DEFAULT_RANKING_TITLE;

  if (entity === "states") {
    return statesTitle;
  }

  return /^Estados\b/u.test(statesTitle)
    ? statesTitle.replace(/^Estados\b/u, "Municípios")
    : DEFAULT_MUNICIPAL_RANKING_TITLE;
}

function buildCompactRankingGroups(
  data: CompactTerritorialAnalysisDataset,
  rankingEntries: Array<[string, (number | null)[]]>,
  scale: number,
  rawTotalLabel: string,
  tCaption?: TranslateFunction,
  severityOrder?: readonly string[],
): AnalysisRankingGroup[] {
  const isAbsolute = data.valueConfig?.type === "absolute";
  const dominantCounts = new Map<string, number>();
  const entriesByClass = data.classes.map(
    () => [] as Array<AnalysisRankingEntry & { numericValue: number }>,
  );

  for (const [entryKey, values] of rankingEntries) {
    const label = getCompactLocationName(data, entryKey);
    let dominantIndex = -1;
    let dominantValue = Number.NEGATIVE_INFINITY;

    for (
      let classIndex = 0;
      classIndex < data.classes.length;
      classIndex += 1
    ) {
      const numericValue = roundToDisplayedDecimals(
        ((values[classIndex] ?? 0) as number) / scale,
      );

      if (numericValue > dominantValue) {
        dominantValue = numericValue;
        dominantIndex = classIndex;
      }

      if (numericValue <= 0) {
        continue;
      }

      entriesByClass[classIndex]?.push({
        id: entryKey,
        label,
        numericValue,
      });
    }

    const dominantClass =
      dominantIndex >= 0 ? data.classes[dominantIndex] : undefined;

    if (!dominantClass) {
      continue;
    }

    dominantCounts.set(
      dominantClass.id,
      (dominantCounts.get(dominantClass.id) ?? 0) + 1,
    );
  }

  const groups = data.classes.map((item, classIndex) => {
    const sortedEntries = (entriesByClass[classIndex] ?? [])
      .slice()
      .sort((left, right) => right.numericValue - left.numericValue);

    const topEntries = sortedEntries.slice(0, MAX_RANKING_ITEMS);

    const allItems = sortedEntries.map(({ numericValue, ...entry }) => ({
      ...entry,
      trailingLabel: isAbsolute
        ? `${formatAbsoluteNumber(numericValue, "pt-BR")} ${data.valueConfig?.unit ?? ""}`.trim()
        : `${formatPercentageNumber(numericValue, "pt-BR")}%`,
    }));

    return {
      id: item.id,
      label: translate(item.label, tCaption),
      tone: getCompactClassTone(item),
      total: sortedEntries.length,
      totalLabel: translate(rawTotalLabel, tCaption),
      items: topEntries.map(({ numericValue, ...entry }) => ({
        ...entry,
        trailingLabel: isAbsolute
          ? `${formatAbsoluteNumber(numericValue, "pt-BR")} ${data.valueConfig?.unit ?? ""}`.trim()
          : `${formatPercentageNumber(numericValue, "pt-BR")}%`,
      })),
      allItems,
    };
  });

  return sortGroupsBySeverity(groups, severityOrder);
}

/**
 * Põe a classe mais grave no topo do ranking, pela ordem de gravidade declarada
 * no catálogo (da melhor para a pior). Sem ordem declarada — cobertura da terra,
 * por exemplo — o ranking segue a ordem da legenda. Uma classe que ficou fora
 * da ordem vai para o fim, sem embaralhar as demais.
 */
function sortGroupsBySeverity(
  groups: AnalysisRankingGroup[],
  severityOrder?: readonly string[],
): AnalysisRankingGroup[] {
  if (!severityOrder || severityOrder.length < 2) {
    return groups;
  }

  const rankOf = (id: string) => severityOrder.indexOf(id);

  return groups
    .map((group, legendIndex) => ({ group, legendIndex }))
    .sort((left, right) => {
      const leftRank = rankOf(left.group.id);
      const rightRank = rankOf(right.group.id);

      if (leftRank !== rightRank) {
        return rightRank - leftRank;
      }

      return left.legendIndex - right.legendIndex;
    })
    .map(({ group }) => group);
}

function buildCompactTerritorialAnalysisViewModel(
  data: CompactTerritorialAnalysisDataset,
  yearKey: string,
  locationKey: string,
  tCaption?: TranslateFunction,
  severityOrder?: readonly string[],
  territoryRanking?: TerritoryRankingState,
): TerritorialAnalysisViewModel | null {
  if (!data.years[yearKey]?.values[locationKey]) {
    return null;
  }

  const resolvedLocationKey = locationKey;
  const distribution = buildCompactDistributionItems(
    data,
    resolvedLocationKey,
    yearKey,
    tCaption,
  );
  const dominant = getDominantDistributionItem(distribution);
  const name = getCompactLocationName(data, resolvedLocationKey);
  const highlight = buildCompactHighlight(
    data,
    dominant,
    name,
    resolvedLocationKey,
    tCaption,
  );
  const rankingSource = resolveRankingSource(
    data,
    yearKey,
    resolvedLocationKey,
    territoryRanking,
  );

  return {
    kind: "territorial",
    name,
    accentColor: dominant?.color ?? "#292829",
    highlight,
    distribution,
    rankingTitle:
      rankingSource.status === "ready"
        ? translate(getRawRankingTitle(data, rankingSource.entity), tCaption)
        : undefined,
    rankingGroups:
      rankingSource.status === "ready"
        ? buildCompactRankingGroups(
            data,
            rankingSource.entries,
            rankingSource.scale,
            rankingSource.entity === "states"
              ? (data.ranking?.totalLabel ?? DEFAULT_RANKING_TOTAL_LABEL)
              : MUNICIPAL_RANKING_TOTAL_LABEL,
            tCaption,
            severityOrder,
          )
        : [],
    rankingStatus: rankingSource.status,
    valueType: data.valueConfig?.type ?? "percentage",
    valueUnit: data.valueConfig?.unit,
    distributionTitle: data.valueConfig?.distributionTitle,
  };
}

export function getAnalysisYearOptions(
  dataset?: PanelLayerI,
): AnalysisYearOption[] {
  const ordered = getImageDataYearKeys(dataset?.imageData);

  return ordered.map((value) => ({
    value,
    label: getImageDataYearLabel(value, dataset),
  }));
}

export function getEffectiveAnalysisYear(
  dataset: PanelLayerI | undefined,
  activeYear: string,
): string | null {
  if (!dataset?.imageData) return null;
  const years = getImageDataYearKeys(dataset.imageData);

  if (activeYear && years.includes(activeYear)) {
    return activeYear;
  }

  return getImageDataDefaultYear(dataset.imageData);
}

export function getAnalysisLegend(
  dataset: PanelLayerI | undefined,
  effectiveYear: string | null,
) {
  if (!dataset?.imageData) {
    return null;
  }

  return getImageDataLegend(dataset.imageData, effectiveYear);
}

export function buildEmbeddedTerritorialAnalysisViewModel(
  dataset: PanelLayerI | undefined,
  effectiveYear: string | null,
  locationKey: string,
  tCaption?: TranslateFunction,
  territoryRanking?: TerritoryRankingState,
): TerritorialAnalysisViewModel | null {
  const compactAnalysis = getCompactAnalysisDataset(dataset, effectiveYear);

  if (!compactAnalysis || !effectiveYear) {
    return null;
  }

  return buildCompactTerritorialAnalysisViewModel(
    compactAnalysis,
    effectiveYear,
    locationKey,
    tCaption,
    dataset?.reportConfig?.severity?.order,
    territoryRanking,
  );
}

export function getAnalysisLocationName(
  dataset: PanelLayerI | undefined,
  effectiveYear: string | null,
  locationKey: string,
): string | null {
  const compactAnalysis = getCompactAnalysisDataset(dataset, effectiveYear);

  if (!compactAnalysis) {
    return null;
  }

  return compactAnalysis.locations?.[locationKey] ?? null;
}
