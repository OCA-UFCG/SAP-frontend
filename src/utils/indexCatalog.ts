import { parseGeeFeatureCollectionStatisticsSource } from "@/contracts/geeStatistics";
import {
  INDEX_CATEGORIES,
  type ClassMapping,
  type EarthEngineAssetMapping,
  type IndexCatalogDraftInput,
  type IndexCategory,
} from "@/types/indexCatalog";

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/iu;
const ASSET_ID_PATTERN = /^[A-Za-z0-9_./{}-]{3,300}$/u;
const PERIOD_PATTERN = /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} é obrigatório.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`${label} deve ter no máximo ${maxLength} caracteres.`);
  }
  return normalized;
}

export function normalizeCatalogText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

export function createCatalogPanelLayerId(name: string) {
  const normalized = normalizeCatalogText(name)
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 72);
  return normalized || "indice";
}

export function makeUniqueCatalogPanelLayerId(
  name: string,
  existingIds: Iterable<string>,
) {
  const base = createCatalogPanelLayerId(name);
  const used = new Set(
    Array.from(existingIds, (id) => id.toLocaleLowerCase("pt-BR")),
  );
  if (!used.has(base)) return base;

  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${base.slice(0, 76 - String(suffix).length)}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("Não foi possível gerar um identificador único.");
}

function parseClasses(value: unknown): ClassMapping[] {
  if (!Array.isArray(value) || value.length > 100) {
    throw new Error("Configuração de classes inválida.");
  }

  const classes = value.map((entry, position) => {
    if (!isRecord(entry)) throw new Error(`Classe ${position + 1} inválida.`);
    const classIndex = Number(entry.classIndex);
    if (!Number.isInteger(classIndex) || classIndex < 0) {
      throw new Error(`Índice da classe ${position + 1} inválido.`);
    }
    const label = requiredString(
      entry.label,
      `Rótulo da classe ${classIndex}`,
      120,
    );
    const color = requiredString(entry.color, `Cor da classe ${classIndex}`, 7);
    if (!HEX_COLOR_PATTERN.test(color)) {
      throw new Error(`Cor da classe ${classIndex} deve usar #RRGGBB.`);
    }
    return {
      classIndex,
      id:
        typeof entry.id === "string" && entry.id.trim()
          ? createCatalogPanelLayerId(entry.id)
          : createCatalogPanelLayerId(label),
      label,
      color: color.toUpperCase(),
      ...(typeof entry.pixelValue === "number" &&
      Number.isFinite(entry.pixelValue)
        ? { pixelValue: entry.pixelValue }
        : { pixelValue: classIndex }),
    };
  });

  const indexes = new Set(classes.map((entry) => entry.classIndex));
  const ids = new Set(classes.map((entry) => entry.id));
  if (indexes.size !== classes.length || ids.size !== classes.length) {
    throw new Error("As classes não podem ter índices ou IDs duplicados.");
  }
  return classes.sort((left, right) => left.classIndex - right.classIndex);
}

function parseEarthEngineMapping(value: unknown): EarthEngineAssetMapping {
  if (!isRecord(value)) {
    throw new Error("O asset de visualização do mapa é obrigatório.");
  }
  const strategy = value.strategy;
  const sourceType = value.sourceType;
  if (strategy !== "single" && strategy !== "perPeriod") {
    throw new Error("Estratégia do asset de mapa inválida.");
  }
  if (
    sourceType !== "image" &&
    sourceType !== "imageCollection" &&
    sourceType !== "featureCollection"
  ) {
    throw new Error("Tipo do asset de mapa inválido.");
  }

  const singleAssetId =
    typeof value.singleAssetId === "string" ? value.singleAssetId.trim() : "";
  const assetPattern =
    typeof value.assetPattern === "string" ? value.assetPattern.trim() : "";
  const assetsByPeriod = isRecord(value.assetsByPeriod)
    ? Object.fromEntries(
        Object.entries(value.assetsByPeriod).flatMap(([period, asset]) =>
          PERIOD_PATTERN.test(period) &&
          typeof asset === "string" &&
          asset.trim()
            ? [[period, asset.trim()]]
            : [],
        ),
      )
    : undefined;

  if (strategy === "single" && !singleAssetId) {
    throw new Error("Informe o asset único de visualização.");
  }
  if (
    strategy === "perPeriod" &&
    !assetPattern &&
    Object.keys(assetsByPeriod ?? {}).length === 0
  ) {
    throw new Error("Informe o template ou os assets de mapa por período.");
  }
  for (const asset of [
    singleAssetId,
    assetPattern,
    ...Object.values(assetsByPeriod ?? {}),
  ]) {
    if (asset && !ASSET_ID_PATTERN.test(asset)) {
      throw new Error(`Asset de visualização inválido: ${asset}.`);
    }
  }

  const thresholds = Array.isArray(value.thresholds)
    ? value.thresholds.map(Number)
    : undefined;
  if (
    thresholds?.some((threshold) => !Number.isFinite(threshold)) ||
    thresholds?.some(
      (threshold, index) => index > 0 && threshold <= thresholds[index - 1],
    )
  ) {
    throw new Error("Os limites do mapa devem ser números crescentes.");
  }

  return {
    strategy,
    sourceType,
    ...(singleAssetId ? { singleAssetId } : {}),
    ...(assetPattern ? { assetPattern } : {}),
    ...(assetsByPeriod ? { assetsByPeriod } : {}),
    ...(typeof value.band === "string" && value.band.trim()
      ? { band: value.band.trim() }
      : {}),
    ...(typeof value.property === "string" && value.property.trim()
      ? { property: value.property.trim() }
      : {}),
    ...(thresholds?.length ? { thresholds } : {}),
  };
}

export function parseIndexCatalogDraftInput(
  value: unknown,
): IndexCatalogDraftInput {
  if (!isRecord(value)) throw new Error("Cadastro inválido.");
  if (
    typeof value.category !== "string" ||
    !(INDEX_CATEGORIES as readonly string[]).includes(value.category)
  ) {
    throw new Error("Categoria inválida.");
  }

  const statisticsSource = parseGeeFeatureCollectionStatisticsSource(
    value.statisticsSource,
  );
  if (statisticsSource.properties.scalarMetrics) {
    throw new Error(
      "O catálogo v2 aceita apenas estatísticas classificatórias nesta versão.",
    );
  }

  return {
    name: requiredString(value.name, "Nome", 120),
    description: requiredString(value.description, "Descrição", 500),
    category: value.category as IndexCategory,
    statisticsSource,
    classes: parseClasses(value.classes),
    earthEngine: parseEarthEngineMapping(value.earthEngine),
  };
}

export function inferTimeScale(periods: readonly string[]) {
  return periods.some((period) => /^\d{4}-\d{2}$/u.test(period))
    ? ("Mensal" as const)
    : periods.some((period) => /^\d{4}$/u.test(period))
      ? ("Anual" as const)
      : undefined;
}

export function expandAssetForPeriod(
  mapping: EarthEngineAssetMapping,
  period: string,
) {
  if (mapping.strategy === "single") return mapping.singleAssetId ?? "";
  return (
    mapping.assetsByPeriod?.[period] ??
    mapping.assetPattern
      ?.replaceAll("{period}", period)
      .replaceAll("{year}", period.slice(0, 4))
      .replaceAll("{month}", period.slice(5, 7)) ??
    ""
  );
}
