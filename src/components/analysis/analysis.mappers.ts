import {
  formatAbsoluteNumber,
  formatPercentageNumber,
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
  CompactTerritorialAnalysisDataset,
  TerritorialAnalysisViewModel,
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

const DEFAULT_RANKING_TITLE = "Estados por classificação";
const DEFAULT_RANKING_TOTAL_LABEL = "Estados";
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
    value: Number((((values[index] ?? 0) as number) / scale).toFixed(1)),
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
  const rawTemplate = data.templates?.highlight ?? DEFAULT_HIGHLIGHT_TEMPLATE;
  const translatedTemplate = translate(rawTemplate, tCaption, {
    label: translatedLabel,
  });

  return {
    label: translatedLabel,
    text: formatTemplate(translatedTemplate, { label: translatedLabel }),
    value: dominant.value,
    tone: getCompactClassTone(compactClass),
  };
}

function buildCompactRankingGroups(
  data: CompactTerritorialAnalysisDataset,
  yearKey: string,
  locationKey: string,
  tCaption?: TranslateFunction,
  severityOrder?: readonly string[],
): AnalysisRankingGroup[] {
  if (locationKey !== "br") {
    return [];
  }

  const yearData = data.years[yearKey];

  if (!yearData) {
    return [];
  }

  const scale = yearData.valuesScale ?? 1;
  const isAbsolute = data.valueConfig?.type === "absolute";
  const dominantCounts = new Map<string, number>();
  const entriesByClass = data.classes.map(
    () => [] as Array<AnalysisRankingEntry & { numericValue: number }>,
  );

  for (const [entryKey, values] of Object.entries(yearData.values)) {
    if (entryKey === "br" || !isStateLocationKey(entryKey)) {
      continue;
    }

    const label = getCompactLocationName(data, entryKey);
    let dominantIndex = -1;
    let dominantValue = Number.NEGATIVE_INFINITY;

    for (
      let classIndex = 0;
      classIndex < data.classes.length;
      classIndex += 1
    ) {
      const numericValue = Number(
        (((values[classIndex] ?? 0) as number) / scale).toFixed(1),
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
      totalLabel: translate(
        data.ranking?.totalLabel ?? DEFAULT_RANKING_TOTAL_LABEL,
        tCaption,
      ),
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
  const highlight = buildCompactHighlight(data, dominant, tCaption);
  const name = getCompactLocationName(data, resolvedLocationKey);
  const rawRankingTitle = data.ranking?.title ?? DEFAULT_RANKING_TITLE;
  const translatedRankingTitle = translate(rawRankingTitle, tCaption);

  return {
    kind: "territorial",
    name,
    accentColor: dominant?.color ?? "#292829",
    highlight,
    distribution,
    rankingTitle:
      resolvedLocationKey === "br" ? translatedRankingTitle : undefined,
    rankingGroups: buildCompactRankingGroups(
      data,
      yearKey,
      resolvedLocationKey,
      tCaption,
      severityOrder,
    ),
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
