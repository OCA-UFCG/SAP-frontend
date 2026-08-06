import {
  INDEX_CATEGORIES,
  type ClassMapping,
  type EarthEngineAssetMapping,
  type IndexCatalogDraftInput,
  type IndexCategory,
  type DriveSourceSelection,
} from "@/types/indexCatalog";

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/iu;
const ASSET_ID_PATTERN = /^[A-Za-z0-9_./{}-]{3,300}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
  value: unknown,
  label: string,
  maxLength: number,
): string {
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

export function fileNameMatchesCatalogTag(name: string, tag: string) {
  const normalizedTag = normalizeCatalogText(tag.trim());

  return (
    Boolean(normalizedTag) && normalizeCatalogText(name).includes(normalizedTag)
  );
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

  if (!used.has(base)) {
    return base;
  }

  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${base.slice(0, 76 - String(suffix).length)}-${suffix}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  throw new Error("Não foi possível gerar um identificador único.");
}

function parseClassMappings(value: unknown): ClassMapping[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new Error("Cadastre pelo menos uma classe ou medida.");
  }

  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Classe ${index + 1} inválida.`);
    }

    const color = requiredString(entry.color, `Cor da classe ${index + 1}`, 7);
    if (!HEX_COLOR_PATTERN.test(color)) {
      throw new Error(
        `Cor da classe ${index + 1} deve usar o formato #RRGGBB.`,
      );
    }

    const column = requiredString(
      entry.column,
      `Coluna da classe ${index + 1}`,
      120,
    );
    const label = requiredString(
      entry.label,
      `Nome da classe ${index + 1}`,
      120,
    );
    const id =
      typeof entry.id === "string" && entry.id.trim()
        ? createCatalogPanelLayerId(entry.id)
        : createCatalogPanelLayerId(label);

    return {
      column,
      label,
      id,
      color: color.toUpperCase(),
      ...(typeof entry.pixelValue === "number" &&
      Number.isFinite(entry.pixelValue)
        ? { pixelValue: entry.pixelValue }
        : {}),
    };
  });
}

function stringArray(value: unknown, label: string, maxItems: number) {
  if (
    !Array.isArray(value) ||
    value.length > maxItems ||
    value.some((entry) => typeof entry !== "string" || entry.length > 300)
  ) {
    throw new Error(`${label} inválido.`);
  }

  return value as string[];
}

function parseDriveSelections(value: unknown): DriveSourceSelection[] {
  if (!Array.isArray(value) || value.length > 100) {
    throw new Error("A seleção de arquivos do Drive é inválida.");
  }
  const roles = new Set([
    "panel",
    "municipal",
    "multilevel",
    "state",
    "unsupported",
  ]);

  return value.map((file, index) => {
    if (!isRecord(file) || !isRecord(file.inspection)) {
      throw new Error(`Arquivo ${index + 1} do Drive inválido.`);
    }

    const id = requiredString(file.id, `ID do arquivo ${index + 1}`, 200);
    const name = requiredString(file.name, `Nome do arquivo ${index + 1}`, 300);
    const mimeType = requiredString(
      file.mimeType,
      `MIME do arquivo ${index + 1}`,
      150,
    );
    const modifiedTime = requiredString(
      file.modifiedTime,
      `Modificação do arquivo ${index + 1}`,
      50,
    );
    if (!Number.isFinite(Date.parse(modifiedTime))) {
      throw new Error(`modifiedTime do arquivo ${name} é inválido.`);
    }

    const role = file.inspection.role;
    if (typeof role !== "string" || !roles.has(role)) {
      throw new Error(`Papel detectado do arquivo ${name} é inválido.`);
    }

    return {
      id,
      name,
      mimeType,
      modifiedTime,
      ...(typeof file.size === "string" && file.size.length <= 30
        ? { size: file.size }
        : {}),
      inspection: {
        role: role as DriveSourceSelection["inspection"]["role"],
        columns: stringArray(
          file.inspection.columns,
          `Colunas do arquivo ${name}`,
          500,
        ),
        periods: stringArray(
          file.inspection.periods,
          `Períodos do arquivo ${name}`,
          500,
        ),
        classColumns: stringArray(
          file.inspection.classColumns,
          `Classes do arquivo ${name}`,
          100,
        ),
        warnings: stringArray(
          file.inspection.warnings,
          `Alertas do arquivo ${name}`,
          100,
        ),
      },
    };
  });
}

function parseEarthEngineMapping(value: unknown): EarthEngineAssetMapping {
  if (!isRecord(value)) {
    throw new Error("Configuração do Earth Engine é obrigatória.");
  }

  const strategy = value.strategy;
  const sourceType = value.sourceType;
  if (strategy !== "single" && strategy !== "perPeriod") {
    throw new Error("Estratégia de asset inválida.");
  }
  if (
    sourceType !== "image" &&
    sourceType !== "imageCollection" &&
    sourceType !== "featureCollection"
  ) {
    throw new Error("Tipo de asset inválido.");
  }

  const singleAssetId =
    typeof value.singleAssetId === "string"
      ? value.singleAssetId.trim()
      : undefined;
  const assetPattern =
    typeof value.assetPattern === "string"
      ? value.assetPattern.trim()
      : undefined;
  const assetsByPeriod = isRecord(value.assetsByPeriod)
    ? Object.fromEntries(
        Object.entries(value.assetsByPeriod).flatMap(([period, asset]) =>
          typeof asset === "string" && asset.trim()
            ? [[period, asset.trim()]]
            : [],
        ),
      )
    : undefined;
  if (Object.keys(assetsByPeriod ?? {}).length > 500) {
    throw new Error("Cadastre no máximo 500 assets por período.");
  }
  if (
    Object.keys(assetsByPeriod ?? {}).some(
      (period) => !/^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/u.test(period),
    )
  ) {
    throw new Error("Os assets por período contêm uma referência inválida.");
  }

  if (strategy === "single" && !singleAssetId) {
    throw new Error("Informe o asset único do Earth Engine.");
  }
  if (
    strategy === "perPeriod" &&
    !assetPattern &&
    Object.keys(assetsByPeriod ?? {}).length === 0
  ) {
    throw new Error("Informe o padrão ou os assets por período.");
  }

  for (const asset of [
    singleAssetId,
    assetPattern,
    ...Object.values(assetsByPeriod ?? {}),
  ]) {
    if (asset && !ASSET_ID_PATTERN.test(asset)) {
      throw new Error(`Asset do Earth Engine inválido: ${asset}.`);
    }
  }

  const thresholds = Array.isArray(value.thresholds)
    ? value.thresholds.map(Number)
    : undefined;
  if (thresholds?.some((threshold) => !Number.isFinite(threshold))) {
    throw new Error("As faixas avançadas devem conter apenas números.");
  }
  if (
    thresholds &&
    (thresholds.length > 20 ||
      thresholds.some(
        (threshold, index) => index > 0 && threshold <= thresholds[index - 1],
      ))
  ) {
    throw new Error(
      "As faixas avançadas devem ser crescentes e ter no máximo 20 limites.",
    );
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
    continuousValues: Boolean(value.continuousValues),
    ...(thresholds?.length ? { thresholds } : {}),
  };
}

export function parseIndexCatalogDraftInput(
  value: unknown,
): IndexCatalogDraftInput {
  if (!isRecord(value)) {
    throw new Error("Cadastro inválido.");
  }

  const category = value.category;
  if (
    typeof category !== "string" ||
    !(INDEX_CATEGORIES as readonly string[]).includes(category)
  ) {
    throw new Error("Categoria inválida.");
  }

  const selectedFiles = parseDriveSelections(value.selectedFiles);

  const valueType = value.valueType;
  if (valueType !== "percentage" && valueType !== "absolute") {
    throw new Error("Tipo de valor inválido.");
  }

  const unit =
    valueType === "percentage"
      ? "%"
      : requiredString(value.unit, "Unidade", 40);

  return {
    name: requiredString(value.name, "Nome", 120),
    description: requiredString(value.description, "Descrição", 500),
    category: category as IndexCategory,
    sourceTag: requiredString(value.sourceTag, "Tag do Drive", 100),
    selectedFiles,
    valueType,
    unit,
    classes: parseClassMappings(value.classes),
    earthEngine: parseEarthEngineMapping(value.earthEngine),
  };
}

export function inferTimeScale(periods: readonly string[]) {
  if (periods.some((period) => /^\d{4}-\d{2}$/u.test(period))) {
    return "Mensal" as const;
  }

  if (periods.some((period) => /^\d{4}$/u.test(period))) {
    return "Anual" as const;
  }

  return undefined;
}

export function expandAssetForPeriod(
  mapping: EarthEngineAssetMapping,
  period: string,
) {
  if (mapping.strategy === "single") {
    return mapping.singleAssetId ?? "";
  }

  return (
    mapping.assetsByPeriod?.[period] ??
    mapping.assetPattern
      ?.replaceAll("{period}", period)
      .replaceAll("{year}", period.slice(0, 4))
      .replaceAll("{month}", period.slice(5, 7)) ??
    ""
  );
}
