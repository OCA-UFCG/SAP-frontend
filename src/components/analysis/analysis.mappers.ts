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
  municipality:
    "Em {name}, predomina a classe {label} com {value}% da área analisada.",
  highlight: "Região maioritariamente {label}",
};

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
  return tCaption.has(`labels.${slug}`) ? tCaption(`labels.${slug}`, values) : text;
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
  const rawTemplate = data.templates?.highlight ?? DEFAULT_HAPPENING_TEMPLATES.highlight;
  const translatedTemplate = translate(rawTemplate, tCaption, { label: translatedLabel });

  return {
    label: translatedLabel,
    text: formatTemplate(
      translatedTemplate,
      { label: translatedLabel },
    ),
    tone: getCompactClassTone(compactClass),
  };
}

function buildCompactRankingGroups(
  data: CompactTerritorialAnalysisDataset,
  yearKey: string,
  locationKey: string,
  tCaption?: TranslateFunction,
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

  return data.classes.map((item, classIndex) => {
    const sortedEntries = (entriesByClass[classIndex] ?? [])
      .slice()
      .sort((left, right) => right.numericValue - left.numericValue);

    const topEntries = sortedEntries.slice(0, MAX_RANKING_ITEMS);

    const allItems = sortedEntries.map(({ numericValue, ...entry }) => ({
      ...entry,
      trailingLabel: `${numericValue.toFixed(1)}%`,
    }));

    return {
      id: item.id,
      label: translate(item.label, tCaption),
      tone: getCompactClassTone(item),
      total: sortedEntries.length,
      totalLabel: translate(data.ranking?.totalLabel ?? DEFAULT_RANKING_TOTAL_LABEL, tCaption),
      items: topEntries.map(({ numericValue, ...entry }) => ({
        ...entry,
        trailingLabel: `${numericValue.toFixed(1)}%`,
      })),
      allItems,
    };
  });
}

function buildCompactTerritorialAnalysisViewModel(
  data: CompactTerritorialAnalysisDataset,
  yearKey: string,
  locationKey: string,
  tCaption?: TranslateFunction,
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
  const rawTemplate =
    resolvedLocationKey === "br"
      ? (data.templates?.country ?? DEFAULT_HAPPENING_TEMPLATES.country)
      : isMunicipalityLocationKey(resolvedLocationKey)
        ? (data.templates?.municipality ??
          data.templates?.state ??
          DEFAULT_HAPPENING_TEMPLATES.municipality)
        : (data.templates?.state ?? DEFAULT_HAPPENING_TEMPLATES.state);
  const translatedTemplate = translate(rawTemplate, tCaption, dominant ? {
    name,
    label: dominant.label,
    value: dominant.value.toFixed(1),
  } : undefined);

  const rawRankingTitle = data.ranking?.title ?? DEFAULT_RANKING_TITLE;
  const translatedRankingTitle = translate(rawRankingTitle, tCaption);

  return {
    kind: "territorial",
    name,
    accentColor: dominant?.color ?? "#292829",
    highlight,
    happening: dominant
      ? formatTemplate(translatedTemplate, {
          name,
          label: dominant.label,
          value: dominant.value.toFixed(1),
        })
      : "",
    distribution,
    rankingTitle:
      resolvedLocationKey === "br"
        ? translatedRankingTitle
        : undefined,
    rankingGroups: buildCompactRankingGroups(
      data,
      yearKey,
      resolvedLocationKey,
      tCaption,
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
