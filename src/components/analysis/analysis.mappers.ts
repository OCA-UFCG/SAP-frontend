import type { PanelLayerI } from "@/utils/interfaces";
import type {
  AnalysisDistributionItem,
  AnalysisHighlight,
  AnalysisRankingEntry,
  AnalysisRankingGroup,
  AnalysisYearOption,
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

const DEFAULT_RANKING_TITLE = "Estados por classe predominante";
const DEFAULT_RANKING_TOTAL_LABEL = "Estados";

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
    tone: compactClass.tone ?? {
      bg: "#F5F5F5",
      color: compactClass.color,
      border: compactClass.color,
    },
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

  const groups = new Map<string, AnalysisRankingEntry[]>();

  for (const [entryKey] of Object.entries(yearData.values)) {
    if (entryKey === "br") {
      continue;
    }

    const distribution = buildCompactDistributionItems(data, entryKey, yearKey);
    const dominant = getDominantDistributionItem(distribution);

    if (!dominant) {
      continue;
    }

    const items = groups.get(dominant.id) ?? [];
    items.push({
      id: entryKey,
      label: getCompactLocationName(data, entryKey),
      trailingLabel: String(dominant.value),
    });
    groups.set(dominant.id, items);
  }

  const rankingGroups: AnalysisRankingGroup[] = [];

  for (const item of data.classes) {
    const entries = groups.get(item.id);

    if (!entries || entries.length === 0) {
      continue;
    }

    entries.sort((left, right) => {
      return Number(right.trailingLabel ?? 0) - Number(left.trailingLabel ?? 0);
    });

    rankingGroups.push({
      id: item.id,
      label: item.label,
      total: entries.length,
      totalLabel: data.ranking?.totalLabel ?? DEFAULT_RANKING_TOTAL_LABEL,
      items: entries.map((entry) => ({
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
