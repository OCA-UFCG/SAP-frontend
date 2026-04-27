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
  getImageDataDefaultYear,
  getImageDataLegend,
  getImageDataYearKeys,
  isCompactImageData,
  resolveImageYearEntry,
} from "@/utils/imageData";

function getImageDataYearLabel(key: string, dataset?: PanelLayerI): string {
  const entry = resolveImageYearEntry(dataset?.imageData, key);

  if (entry?.year?.trim()) {
    return entry.year.trim();
  }

  return key === "general" ? "Padrão" : key;
}

const DEFAULT_HAPPENING_TEMPLATES = {
  country:
    "No Brasil, predomina a classe {label} com {value}% da área analisada.",
  state:
    "Em {name}, predomina a classe {label} com {value}% da área analisada.",
  highlight: "Região maioritariamente {label}",
};

const DEFAULT_RANKING_TITLE = "Estados por classificação";
const DEFAULT_RANKING_TOTAL_LABEL = "Estados";
const MAX_RANKING_ITEMS = 5;

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
): AnalysisDistributionItem[] {
  const yearData = data.years[yearKey];
  const values = yearData?.values[locationKey];

  if (!yearData || !values) {
    return [];
  }

  const scale = yearData.valuesScale ?? 1;

  return data.classes.map((item, index) => ({
    id: item.id,
    label: item.label,
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
    (locationKey === "br" ? "Brasil" : locationKey)
  );
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
): AnalysisHighlight | null {
  if (!dominant) {
    return null;
  }

  const compactClass = data.classes.find((item) => item.id === dominant.id);

  if (!compactClass) {
    return null;
  }

  return {
    label: compactClass.label,
    text: formatTemplate(
      data.templates?.highlight ?? DEFAULT_HAPPENING_TEMPLATES.highlight,
      { label: compactClass.label },
    ),
    tone: getCompactClassTone(compactClass),
  };
}

function buildCompactRankingGroups(
  data: CompactTerritorialAnalysisDataset,
  yearKey: string,
  locationKey: string,
): AnalysisRankingGroup[] {
  if (locationKey !== "br") {
    return [];
  }

  const yearData = data.years[yearKey];

  if (!yearData) {
    return [];
  }

  const scale = yearData.valuesScale ?? 1;
  const dominantCounts = new Map<string, number>();

  for (const [entryKey] of Object.entries(yearData.values)) {
    if (entryKey === "br") {
      continue;
    }

    const dominant = getDominantDistributionItem(
      buildCompactDistributionItems(data, entryKey, yearKey),
    );

    if (!dominant) {
      continue;
    }

    dominantCounts.set(dominant.id, (dominantCounts.get(dominant.id) ?? 0) + 1);
  }

  const rankingGroups: AnalysisRankingGroup[] = [];

  for (const [classIndex, item] of data.classes.entries()) {
    const entries = Object.entries(yearData.values)
      .filter(([entryKey]) => entryKey !== "br")
      .map(([entryKey, values]) => ({
        id: entryKey,
        label: getCompactLocationName(data, entryKey),
        trailingLabel: String(
          Number((((values[classIndex] ?? 0) as number) / scale).toFixed(1)),
        ),
      }))
      .filter((entry) => Number(entry.trailingLabel ?? 0) > 0);

    entries.sort((left, right) => {
      return Number(right.trailingLabel ?? 0) - Number(left.trailingLabel ?? 0);
    });

    const topEntries = entries.slice(0, MAX_RANKING_ITEMS);

    rankingGroups.push({
      id: item.id,
      label: item.label,
      tone: getCompactClassTone(item),
      total: dominantCounts.get(item.id) ?? 0,
      totalLabel: data.ranking?.totalLabel ?? DEFAULT_RANKING_TOTAL_LABEL,
      items: topEntries.map((entry) => ({
        ...entry,
        trailingLabel: `${Number(entry.trailingLabel ?? 0).toFixed(1)}%`,
      })),
    });
  }

  return rankingGroups;
}

function buildCompactTerritorialAnalysisViewModel(
  data: CompactTerritorialAnalysisDataset,
  yearKey: string,
  locationKey: string,
): TerritorialAnalysisViewModel | null {
  if (!data.years[yearKey]?.values[locationKey]) {
    return null;
  }

  const resolvedLocationKey = locationKey;
  const distribution = buildCompactDistributionItems(
    data,
    resolvedLocationKey,
    yearKey,
  );
  const dominant = getDominantDistributionItem(distribution);
  const highlight = buildCompactHighlight(data, dominant);
  const name = getCompactLocationName(data, resolvedLocationKey);
  const happeningTemplate =
    resolvedLocationKey === "br"
      ? (data.templates?.country ?? DEFAULT_HAPPENING_TEMPLATES.country)
      : (data.templates?.state ?? DEFAULT_HAPPENING_TEMPLATES.state);

  return {
    kind: "territorial",
    name,
    accentColor: dominant?.color ?? "#292829",
    highlight,
    happening: dominant
      ? formatTemplate(happeningTemplate, {
          name,
          label: dominant.label,
          value: dominant.value.toFixed(1),
        })
      : "",
    distribution,
    rankingTitle:
      resolvedLocationKey === "br"
        ? (data.ranking?.title ?? DEFAULT_RANKING_TITLE)
        : undefined,
    rankingGroups: buildCompactRankingGroups(
      data,
      yearKey,
      resolvedLocationKey,
    ),
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
): TerritorialAnalysisViewModel | null {
  const compactAnalysis = getCompactAnalysisDataset(dataset, effectiveYear);

  if (!compactAnalysis || !effectiveYear) {
    return null;
  }

  return buildCompactTerritorialAnalysisViewModel(
    compactAnalysis,
    effectiveYear,
    locationKey,
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

  return getCompactLocationName(compactAnalysis, locationKey);
}
