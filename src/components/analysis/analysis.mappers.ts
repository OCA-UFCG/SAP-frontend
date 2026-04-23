import { classificationMeta } from "@/utils/constants";
import type { ClassificationKey } from "@/utils/constants";
import type { SecaData, PanelLayerI } from "@/utils/interfaces";
import type {
  AnalysisDistributionItem,
  AnalysisYearOption,
  LayerAnalysisConfig,
  TerritorialAnalysisViewModel,
} from "@/utils/analysis";

function getImageDataYearLabel(
  key: string,
  entry?: PanelLayerI["imageData"][string],
): string {
  if (entry?.year?.trim()) {
    return entry.year.trim();
  }

  return key === "general" ? "Padrão" : key;
}

const LEGACY_DISTRIBUTION_CONFIG: Record<ClassificationKey, { label: string; color: string }> = {
  "sem-seca": { label: "Sem seca", color: "#F0F0D7" },
  observacao: { label: "Observação", color: "#FECB89" },
  atencao: { label: "Atenção", color: "#FC8F23" },
  alerta: { label: "Seca severa", color: "#B52C08" },
  "recuperacao-total": { label: "Recuperação Total", color: "#B4BA61" },
  "recuperacao-parcial": { label: "Recuperação Parcial", color: "#5B612A" },
};

function getPredominantClassification(
  status: Record<ClassificationKey, number>,
): ClassificationKey {
  return (Object.entries(status) as [ClassificationKey, number][]).reduce(
    (max, cur) => (cur[1] > max[1] ? cur : max),
  )[0];
}

function buildLegacyDistributionItems(
  status: Record<ClassificationKey, number>,
): AnalysisDistributionItem[] {
  return Object.entries(status).map(([key, rawValue]) => {
    const config = LEGACY_DISTRIBUTION_CONFIG[key as ClassificationKey];

    return {
      id: key,
      label: config.label,
      value: Number(((rawValue as number) * 100).toFixed(1)),
      color: config.color,
    };
  });
}

export function getAnalysisYearOptions(dataset?: PanelLayerI): AnalysisYearOption[] {
  const keys = Object.keys(dataset?.imageData ?? {});
  const yearKeys = keys.filter((key) => key !== "general");

  yearKeys.sort((left, right) => {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    const bothNumeric = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);

    return bothNumeric ? leftNumber - rightNumber : left.localeCompare(right);
  });

  const ordered = keys.includes("general") ? ["general", ...yearKeys] : yearKeys;

  return ordered.map((value) => ({
    value,
    label: getImageDataYearLabel(value, dataset?.imageData?.[value]),
  }));
}

export function getEffectiveAnalysisYear(
  dataset: PanelLayerI | undefined,
  activeYear: string,
): string | null {
  if (!dataset?.imageData) return null;
  if (activeYear && dataset.imageData[activeYear]) return activeYear;

  const entries = Object.entries(dataset.imageData);
  const defaultEntry = entries.find(([, value]) => value.default) ?? entries[0];

  return defaultEntry?.[0] ?? null;
}

export function getAnalysisConfig(
  dataset: PanelLayerI | undefined,
  effectiveYear: string | null,
): LayerAnalysisConfig | undefined {
  if (!dataset?.imageData || !effectiveYear) return undefined;

  return dataset.imageData[effectiveYear]?.analysis;
}

export function buildEmbeddedTerritorialAnalysisViewModel(
  config: LayerAnalysisConfig | undefined,
  locationKey: string,
): TerritorialAnalysisViewModel | null {
  if (!config || config.type !== "territorial" || !config.data) {
    return null;
  }

  const location =
    config.data.locations[locationKey] ?? config.data.locations.br ?? null;

  if (!location) {
    return null;
  }

  const colorById = Object.fromEntries(
    (location.distribution ?? []).map((d) => [d.id, d.color]),
  );
  return {
    kind: "territorial",
    name: location.name,
    accentColor:
      location.accentColor ?? location.highlight?.tone.color ?? "#292829",
    highlight: location.highlight ?? null,
    happening: location.happening ?? "",
    distribution: location.distribution ?? [],
    rankingTitle: location.rankingTitle,
    rankingGroups: (location.rankingGroups ?? []).map((group) => ({
      ...group,
      color: colorById[group.id] ?? null,
    })),
    temporalSections: location.temporalSections ?? [],
  };
}

export function buildLegacyTerritorialAnalysisViewModel(
  locationData: SecaData & { nome: string },
): TerritorialAnalysisViewModel {
  const predominantKey = getPredominantClassification(locationData.status);
  const predominantMeta = classificationMeta[predominantKey];

  return {
    kind: "territorial",
    name: locationData.nome,
    accentColor: predominantMeta.color,
    highlight: {
      label: predominantMeta.label,
      text: `Região maioritariamente ${predominantMeta.label}`,
      tone: {
        color: predominantMeta.color,
        bg: predominantMeta.bg,
        border: predominantMeta.border,
      },
    },
    happening: locationData.acontecendo,
    distribution: buildLegacyDistributionItems(locationData.status),
    rankingTitle: "Estados por classificação",
    rankingGroups: [],
    temporalSections: [],
  };
}