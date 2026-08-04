import "server-only";

import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  type CatalogValidationIssue,
  type CatalogValidationReport,
  type ClassMapping,
  type IndexCatalogBuildResult,
  type IndexCatalogConfig,
} from "@/types/indexCatalog";
import { expandAssetForPeriod, inferTimeScale } from "@/utils/indexCatalog";
import { inspectEarthEngineAsset } from "@/app/api/ee/services";
import { resolveSelectedDriveFiles } from "@/services/indexCatalog/googleDrive";
import {
  getCatalogRowPeriod,
  inspectCatalogCsvRows,
} from "@/utils/indexCatalogDrive";
import basePipelineConfig from "../../../tools/drive-contentful-pipeline/config/pipeline-config.json";
import { toRows } from "../../../tools/drive-contentful-pipeline/lib/csv/csv-parser.mjs";
import { normalizePipelineConfig } from "../../../tools/drive-contentful-pipeline/lib/config/pipeline-config.mjs";
import { convertCsvDirectory } from "../../../tools/drive-contentful-pipeline/lib/conversion/output-files.mjs";
import { validatePanelLayerImageData } from "../../../tools/drive-contentful-pipeline/lib/validation/panel-layer.mjs";

function toSafeCsvName(name: string, index: number) {
  const normalized = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9._ -]+/gu, "_")
    .trim();
  const withExtension = normalized.toLowerCase().endsWith(".csv")
    ? normalized
    : `${normalized}.csv`;
  return `${String(index + 1).padStart(3, "0")}-${withExtension}`;
}

function getSourceFingerprint(config: IndexCatalogConfig) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        panelLayerId: config.panelLayerId,
        sourceTag: config.sourceTag,
        files: config.selectedFiles.map(({ id, modifiedTime }) => ({
          id,
          modifiedTime,
        })),
        valueType: config.valueType,
        unit: config.unit,
        classes: config.classes,
        earthEngine: config.earthEngine,
      }),
    )
    .digest("hex");
}

function classPixelValue(entry: ClassMapping, index: number) {
  if (typeof entry.pixelValue === "number") {
    return entry.pixelValue;
  }

  const suffix = entry.column.match(/_(\d+)$/u)?.[1];
  return suffix ? Number(suffix) : index;
}

function mixHexWithWhite(color: string, amount: number) {
  const hex = color.replace("#", "");
  const components = [0, 2, 4].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  );
  const mixed = components.map((component) =>
    Math.round(255 - (255 - component) * amount),
  );

  return `#${mixed
    .map((component) => component.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function formatBreak(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function buildRangeLegend(thresholds: number[], palette: string[]) {
  return palette.map((color, index) => {
    const lower = index === 0 ? null : thresholds[index - 1];
    const upper = index === thresholds.length ? null : thresholds[index];
    const label =
      lower == null
        ? `Até ${formatBreak(upper ?? 0)}`
        : upper == null
          ? `Acima de ${formatBreak(lower)}`
          : `${formatBreak(lower)} a ${formatBreak(upper)}`;

    return {
      id: `faixa-${index + 1}`,
      label,
      color,
      pixelLimit: index,
    };
  });
}

function getObservedScalarRange(imageData: {
  years?: Record<string, { values?: Record<string, number[]> }>;
}) {
  const values = Object.values(imageData.years ?? {}).flatMap((year) =>
    Object.values(year.values ?? {}).flatMap((entry) =>
      typeof entry[0] === "number" && Number.isFinite(entry[0])
        ? [entry[0]]
        : [],
    ),
  );

  if (values.length === 0) {
    return { min: 0, max: 100 };
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function createEqualThresholds(min: number, max: number) {
  if (min === max) {
    return [min + 1, min + 2, min + 3, min + 4];
  }

  const step = (max - min) / 5;
  return [1, 2, 3, 4].map((index) => Number((min + step * index).toFixed(6)));
}

function buildBaseMapVisualization(config: IndexCatalogConfig) {
  const pixels = config.classes.map(classPixelValue);
  const palette = config.classes.map((entry) => entry.color);
  const continuous = Boolean(config.earthEngine.continuousValues);

  return {
    sourceType: config.earthEngine.sourceType,
    ...(config.earthEngine.band
      ? {
          band: config.earthEngine.band,
          sourceBand: config.earthEngine.band,
        }
      : {}),
    ...(config.earthEngine.property
      ? { property: config.earthEngine.property }
      : {}),
    min: continuous ? 0 : Math.min(...pixels),
    max: continuous ? Math.max(palette.length - 1, 1) : Math.max(...pixels),
    palette,
    legend: config.classes.map((entry, index) => ({
      id: entry.id,
      label: entry.label,
      color: entry.color,
      pixelLimit: classPixelValue(entry, index),
    })),
    ...(continuous && config.earthEngine.thresholds?.length
      ? { thresholds: config.earthEngine.thresholds }
      : {}),
    ...(config.earthEngine.sourceType === "featureCollection"
      ? { outline: { color: "#000000", width: 0.5, opacity: 1 } }
      : {}),
  };
}

function finalizeContinuousVisualization(
  config: IndexCatalogConfig,
  imageData: IndexCatalogBuildResult["panelLayerImageData"],
) {
  const base = buildBaseMapVisualization(config);
  if (!config.earthEngine.continuousValues) {
    return base;
  }

  const observed = getObservedScalarRange(imageData);
  const thresholds = config.earthEngine.thresholds?.length
    ? config.earthEngine.thresholds
    : config.valueType === "percentage"
      ? [20, 40, 60, 80]
      : createEqualThresholds(observed.min, observed.max);
  const baseColor = config.classes.at(-1)?.color ?? "#989F43";
  const palette =
    config.classes.length === thresholds.length + 1
      ? config.classes.map((entry) => entry.color)
      : [0.2, 0.4, 0.6, 0.8, 1].map((amount) =>
          mixHexWithWhite(baseColor, amount),
        );

  return {
    ...base,
    min: 0,
    max: palette.length - 1,
    thresholds,
    palette,
    legend: buildRangeLegend(thresholds, palette),
  };
}

function buildTemplates(config: IndexCatalogConfig) {
  if (config.valueType === "absolute") {
    return {
      country: `No Brasil, o valor observado foi {value} ${config.unit}.`,
      state: `Em {name}, o valor observado foi {value} ${config.unit}.`,
      municipality: `Em {name}, o valor observado foi {value} ${config.unit}.`,
      highlight: `${config.name}: {value} ${config.unit}`,
    };
  }

  return {
    country:
      "No Brasil, predomina a classe {label} com {value}% da área analisada.",
    state:
      "Em {name}, predomina a classe {label} com {value}% da área analisada.",
    municipality:
      "No município de {name}, predomina a classe {label} com {value}% da área analisada.",
    highlight: "Região maioritariamente {label}",
  };
}

async function validateEarthEngineAssets(
  config: IndexCatalogConfig,
  periods: string[],
) {
  const errors: CatalogValidationIssue[] = [];
  const warnings: CatalogValidationIssue[] = [];
  const assets = new Map<string, string[]>();
  const inferredBands = new Set<string>();
  const inferredProperties = new Set<string>();

  for (const period of periods) {
    const assetId = expandAssetForPeriod(config.earthEngine, period);
    if (!assetId) {
      errors.push({
        code: "missing_asset",
        message: `Nenhum asset foi configurado para ${period}.`,
        period,
      });
      continue;
    }
    assets.set(assetId, [...(assets.get(assetId) ?? []), period]);
  }

  for (const [assetId, assetPeriods] of assets) {
    try {
      const inspection = await inspectEarthEngineAsset(assetId);
      if (inspection.type !== config.earthEngine.sourceType) {
        errors.push({
          code: "asset_type_mismatch",
          message: `${assetId} é ${inspection.type}, mas o cadastro informa ${config.earthEngine.sourceType}.`,
        });
      }
      if (inspection.bands.length === 1) {
        inferredBands.add(inspection.bands[0]);
      }
      if (inspection.properties.length === 1) {
        inferredProperties.add(inspection.properties[0]);
      }

      for (const period of assetPeriods) {
        const band = config.earthEngine.band
          ?.replaceAll("{period}", period)
          .replaceAll("{year}", period.slice(0, 4));
        const property = config.earthEngine.property
          ?.replaceAll("{period}", period)
          .replaceAll("{year}", period);

        if (
          band &&
          inspection.bands.length > 0 &&
          !inspection.bands.includes(band)
        ) {
          errors.push({
            code: "band_not_found",
            message: `A banda ${band} não existe em ${assetId}.`,
            period,
          });
        }
        if (
          property &&
          inspection.properties.length > 0 &&
          !inspection.properties.includes(property)
        ) {
          errors.push({
            code: "property_not_found",
            message: `A propriedade ${property} não existe em ${assetId}.`,
            period,
          });
        }
      }

      if (!config.earthEngine.band && inspection.bands.length > 1) {
        errors.push({
          code: "ambiguous_band",
          message: `${assetId} possui várias bandas; selecione uma no formulário.`,
        });
      }
    } catch (error) {
      errors.push({
        code: "asset_unavailable",
        message: `Não foi possível validar ${assetId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  if (
    !config.earthEngine.band &&
    config.earthEngine.sourceType !== "featureCollection"
  ) {
    if (inferredBands.size === 1) {
      config.earthEngine.band = [...inferredBands][0];
    } else if (inferredBands.size > 1) {
      errors.push({
        code: "different_single_bands",
        message:
          "Os assets por período possuem bandas únicas com nomes diferentes; informe um padrão de banda.",
      });
    }
  }
  if (
    config.earthEngine.sourceType === "featureCollection" &&
    !config.earthEngine.property
  ) {
    if (inferredProperties.size === 1) {
      config.earthEngine.property = [...inferredProperties][0];
    } else {
      errors.push({
        code: "missing_property",
        message:
          inferredProperties.size > 1
            ? "Os assets possuem propriedades diferentes; informe a propriedade usada."
            : "Informe a propriedade usada pelo FeatureCollection.",
      });
    }
  }

  const deduplicate = (issues: CatalogValidationIssue[]) => {
    const seen = new Set<string>();
    return issues
      .filter((issue) => {
        const key = `${issue.code}::${issue.fileId ?? ""}::${issue.period ?? ""}::${issue.message}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 200);
  };

  return {
    errors: deduplicate(errors),
    warnings: deduplicate(warnings),
  };
}

function validateSelectedSources(config: IndexCatalogConfig) {
  const errors: CatalogValidationIssue[] = [];
  const warnings: CatalogValidationIssue[] = [];
  const supported = config.selectedFiles.filter(
    (file) => file.inspection.role !== "unsupported",
  );
  const classCounts = new Set(
    supported
      .map((file) => file.inspection.classColumns.length)
      .filter(Boolean),
  );
  const hasPanelSource = supported.some((file) =>
    ["panel", "multilevel"].includes(file.inspection.role),
  );
  const hasMunicipalSource = supported.some((file) =>
    ["municipal", "multilevel"].includes(file.inspection.role),
  );
  const selectedIds = new Set(config.selectedFiles.map((file) => file.id));
  const classIds = new Set(config.classes.map((entry) => entry.id));
  const classPixelValues = new Set(
    config.classes.map((entry, index) => classPixelValue(entry, index)),
  );

  if (config.selectedFiles.length === 0) {
    errors.push({
      code: "no_files",
      message: "Selecione pelo menos um arquivo do Drive.",
    });
  }
  if (supported.length !== config.selectedFiles.length) {
    errors.push({
      code: "unsupported_file",
      message: "Remova os arquivos cujo formato não foi reconhecido.",
    });
  }
  if (!hasPanelSource) {
    errors.push({
      code: "missing_panel_source",
      message:
        "Selecione um arquivo de painel/agregado ou multinível; o MVP não agrega Brasil/UF a partir de municípios.",
    });
  }
  if (!hasMunicipalSource) {
    errors.push({
      code: "missing_municipal_source",
      message:
        "Selecione um arquivo municipal ou multinível para habilitar o detalhamento territorial.",
    });
  }
  if (selectedIds.size !== config.selectedFiles.length) {
    errors.push({
      code: "duplicate_drive_selection",
      message: "A seleção contém o mesmo arquivo do Drive mais de uma vez.",
    });
  }
  if (classIds.size !== config.classes.length) {
    errors.push({
      code: "duplicate_class_id",
      message: "Os nomes das classes geraram identificadores duplicados.",
    });
  }
  if (classPixelValues.size !== config.classes.length) {
    errors.push({
      code: "duplicate_class_value",
      message: "Cada classe deve ter um código de pixel diferente.",
    });
  }
  if (classCounts.size > 1) {
    errors.push({
      code: "class_count_mismatch",
      message:
        "Os arquivos selecionados possuem quantidades de classes diferentes.",
    });
  }
  if (classCounts.size === 1 && !classCounts.has(config.classes.length)) {
    errors.push({
      code: "class_mapping_mismatch",
      message:
        "A quantidade de classes cadastradas não corresponde às colunas detectadas.",
    });
  }

  for (const file of config.selectedFiles) {
    warnings.push(
      ...file.inspection.warnings.map((message) => ({
        code: "source_warning",
        message,
        fileId: file.id,
      })),
    );
  }

  return { errors, warnings };
}

function parseCsvNumber(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function actualLocationKey(row: Record<string, string>, role: string) {
  if (role === "panel") return String(row.location_key ?? "").trim();
  if (role === "municipal") return String(row.CD_MUN ?? "").trim();
  if (role === "state")
    return String(row.SIGLA_UF ?? "")
      .trim()
      .toLowerCase();
  if (role === "multilevel") {
    return [row.NIVEL_AGRUPAMENTO, row.CD_MUN, row.SIGLA_UF, row.NOME_LOCAL]
      .map((value) => String(value ?? "").trim())
      .join("::");
  }
  return "";
}

function validateResolvedDriveContents(
  config: IndexCatalogConfig,
  resolvedFiles: Awaited<ReturnType<typeof resolveSelectedDriveFiles>>,
) {
  const errors: CatalogValidationIssue[] = [];
  const warnings: CatalogValidationIssue[] = [];

  for (const resolved of resolvedFiles) {
    const rows = toRows(resolved.text) as Array<Record<string, string>>;
    const inspection = inspectCatalogCsvRows(rows);
    const fileId = resolved.metadata.id;
    const selectedInspection = resolved.selected.inspection;

    if (inspection.role === "unsupported") {
      errors.push({
        code: "unsupported_file_content",
        message: `${resolved.metadata.name} não segue um formato territorial reconhecido.`,
        fileId,
      });
      continue;
    }
    if (
      inspection.role !== selectedInspection.role ||
      JSON.stringify(inspection.periods) !==
        JSON.stringify(selectedInspection.periods) ||
      JSON.stringify(inspection.classColumns) !==
        JSON.stringify(selectedInspection.classColumns)
    ) {
      errors.push({
        code: "source_inspection_changed",
        message: `A estrutura detectada de ${resolved.metadata.name} diverge da seleção. Pesquise novamente no Drive.`,
        fileId,
      });
    }

    const actualClassSuffixes = inspection.classColumns.map(
      (column) => column.match(/_(\d+)$/u)?.[1] ?? "",
    );
    const mappedClassSuffixes = config.classes.map(
      (entry) => entry.column.match(/_(\d+)$/u)?.[1] ?? "",
    );
    if (
      actualClassSuffixes.length !== mappedClassSuffixes.length ||
      actualClassSuffixes.some(
        (suffix, index) => suffix !== mappedClassSuffixes[index],
      )
    ) {
      errors.push({
        code: "ambiguous_class_mapping",
        message: `A associação classe–coluna de ${resolved.metadata.name} precisa ser corrigida.`,
        fileId,
      });
    }

    const duplicateKeys = new Set<string>();
    const seenKeys = new Set<string>();
    const periodHasNonZero = new Map<string, boolean>();

    for (const row of rows) {
      const period = getCatalogRowPeriod(row);
      const locationKey = actualLocationKey(row, inspection.role);
      if (!period || !locationKey) continue;

      if (
        inspection.role === "municipal" &&
        !/^\d{7}$/u.test(String(row.CD_MUN ?? "").trim())
      ) {
        errors.push({
          code: "invalid_municipality_code",
          message: `${resolved.metadata.name} contém código municipal inválido.`,
          fileId,
          period,
        });
        break;
      }
      if (
        ["municipal", "state"].includes(inspection.role) &&
        !/^[A-Za-z]{2}$/u.test(String(row.SIGLA_UF ?? "").trim())
      ) {
        errors.push({
          code: "invalid_state_code",
          message: `${resolved.metadata.name} contém uma UF inválida.`,
          fileId,
          period,
        });
        break;
      }

      const key = `${locationKey}::${period}`;
      if (seenKeys.has(key)) duplicateKeys.add(key);
      seenKeys.add(key);

      const rawValues = inspection.classColumns.map((column) =>
        parseCsvNumber(row[column]),
      );
      if (rawValues.some((value) => value === null)) {
        errors.push({
          code: "empty_or_invalid_value",
          message: `${resolved.metadata.name} contém valor vazio ou não numérico em ${locationKey}/${period}.`,
          fileId,
          period,
        });
        continue;
      }
      const numericValues = rawValues as number[];
      periodHasNonZero.set(
        period,
        Boolean(
          periodHasNonZero.get(period) ||
          numericValues.some((value) => value !== 0),
        ),
      );

      if (
        config.valueType === "percentage" &&
        !inspection.classColumns[0]?.startsWith("area_ha_")
      ) {
        if (numericValues.some((value) => value < 0 || value > 100)) {
          errors.push({
            code: "percentage_out_of_range",
            message: `${resolved.metadata.name} contém percentual fora do intervalo de 0 a 100.`,
            fileId,
            period,
          });
        }
        if (
          numericValues.length > 1 &&
          Math.abs(
            numericValues.reduce((total, value) => total + value, 0) - 100,
          ) > 0.5
        ) {
          errors.push({
            code: "percentage_sum",
            message: `${resolved.metadata.name} contém classes que não totalizam aproximadamente 100% em ${locationKey}/${period}.`,
            fileId,
            period,
          });
        }
      }
    }

    if (duplicateKeys.size > 0) {
      errors.push({
        code: "duplicate_territory_period",
        message: `${resolved.metadata.name} contém território/período duplicado.`,
        fileId,
      });
    }
    for (const [period, hasNonZero] of periodHasNonZero) {
      if (!hasNonZero) {
        warnings.push({
          code: "zero_period",
          message: `${resolved.metadata.name} possui o período ${period} totalmente zerado.`,
          fileId,
          period,
        });
      }
    }
  }

  const uniqueIssues = (issues: CatalogValidationIssue[]) => {
    const seen = new Set<string>();
    return issues
      .filter((issue) => {
        const key = `${issue.code}::${issue.fileId ?? ""}::${issue.period ?? ""}::${issue.message}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 200);
  };

  return {
    errors: uniqueIssues(errors),
    warnings: uniqueIssues(warnings),
  };
}

function createValidationReport(
  config: IndexCatalogConfig,
  params: {
    errors: CatalogValidationIssue[];
    warnings: CatalogValidationIssue[];
    periods: string[];
    locations: number;
    municipalLocations: number;
    imageDataBytes?: number;
  },
): CatalogValidationReport {
  return {
    validatedAt: new Date().toISOString(),
    valid: params.errors.length === 0,
    errors: params.errors,
    warnings: params.warnings,
    inferred: {
      panelLayerId: config.panelLayerId,
      periods: params.periods,
      defaultPeriod: params.periods.at(-1),
      timeScale: inferTimeScale(params.periods),
      locations: params.locations,
      municipalLocations: params.municipalLocations,
      panelSourceCount: config.selectedFiles.filter((file) =>
        ["panel", "multilevel"].includes(file.inspection.role),
      ).length,
      municipalSourceCount: config.selectedFiles.filter((file) =>
        ["municipal", "multilevel"].includes(file.inspection.role),
      ).length,
      ...(params.imageDataBytes
        ? { imageDataBytes: params.imageDataBytes }
        : {}),
    },
    sourceFingerprint: getSourceFingerprint(config),
  };
}

export async function buildCatalogDraft(
  config: IndexCatalogConfig,
): Promise<IndexCatalogBuildResult> {
  const sourceValidation = validateSelectedSources(config);
  const initialPeriods = [
    ...new Set(config.selectedFiles.flatMap((file) => file.inspection.periods)),
  ].sort();
  const assetValidation = await validateEarthEngineAssets(
    config,
    initialPeriods,
  );
  const initialErrors = [...sourceValidation.errors, ...assetValidation.errors];
  const initialWarnings = [
    ...sourceValidation.warnings,
    ...assetValidation.warnings,
  ];

  if (initialErrors.length > 0) {
    const validation = createValidationReport(config, {
      errors: initialErrors,
      warnings: initialWarnings,
      periods: initialPeriods,
      locations: 0,
      municipalLocations: 0,
    });
    throw Object.assign(new Error("Validação do catálogo falhou."), {
      validation,
    });
  }

  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), "sap-index-catalog-"),
  );
  const csvDir = path.join(temporaryRoot, "csv");
  const jsonDir = path.join(temporaryRoot, "json");

  try {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(csvDir, { recursive: true });
    const resolvedFiles = await resolveSelectedDriveFiles(config.selectedFiles);
    const contentValidation = validateResolvedDriveContents(
      config,
      resolvedFiles,
    );
    initialErrors.push(...contentValidation.errors);
    initialWarnings.push(...contentValidation.warnings);

    if (initialErrors.length > 0) {
      const validation = createValidationReport(config, {
        errors: initialErrors,
        warnings: initialWarnings,
        periods: initialPeriods,
        locations: 0,
        municipalLocations: 0,
      });
      throw Object.assign(new Error("Validação dos CSVs falhou."), {
        validation,
      });
    }
    const snapshotFiles = [];

    for (const [index, resolved] of resolvedFiles.entries()) {
      const localName = toSafeCsvName(resolved.metadata.name, index);
      await writeFile(path.join(csvDir, localName), resolved.text, "utf8");
      snapshotFiles.push({
        id: resolved.metadata.id,
        name: resolved.metadata.name,
        localName,
        mimeType: resolved.metadata.mimeType,
        modifiedTime: resolved.metadata.modifiedTime,
        ...(resolved.metadata.size ? { size: resolved.metadata.size } : {}),
      });
    }

    await writeFile(
      path.join(csvDir, ".drive-csv-snapshot.json"),
      JSON.stringify({
        schemaVersion: 1,
        capturedAt: new Date().toISOString(),
        files: snapshotFiles,
      }),
      "utf8",
    );

    const configuredPeriods = initialPeriods;
    const imageIdByYear = Object.fromEntries(
      configuredPeriods.map((period) => [
        period,
        expandAssetForPeriod(config.earthEngine, period),
      ]),
    );
    const profile = {
      classes: config.classes.map((entry, index) => ({
        id: entry.id,
        label: entry.label,
        color: entry.color,
        pixelLimit: classPixelValue(entry, index),
      })),
      templates: buildTemplates(config),
      ranking: {
        title:
          config.valueType === "absolute"
            ? `Estados por ${config.unit}`
            : "Estados por classe predominante",
        totalLabel: "Estados",
      },
      valueConfig: {
        type: config.valueType,
        unit: config.unit,
      },
      mapVisualization: buildBaseMapVisualization(config),
      overrideCsvImageId: true,
      allowMultilevelPanelLayer: true,
      ...(config.earthEngine.strategy === "single"
        ? { imageId: config.earthEngine.singleAssetId }
        : { imageIdByYear }),
    };
    const dynamicConfig = normalizePipelineConfig({
      ...basePipelineConfig,
      drive: { folderId: "catalog-selection" },
      paths: { csvDir, jsonDir },
      layerRules: [
        {
          key: config.panelLayerId,
          label: config.name,
          panelLayerId: config.panelLayerId,
          patterns: [".*"],
        },
      ],
      panelLayerProfiles: {
        [config.panelLayerId]: profile,
      },
    });
    const conversion = await convertCsvDirectory(
      {
        csvDir,
        jsonDir,
        fileNamePattern: /\.csv$/iu,
        writeAggregates: false,
        writeRawPartitions: false,
        maxContentfulJsonBytes:
          basePipelineConfig.limits.maxContentfulJsonBytes,
      },
      dynamicConfig,
    );
    const blockingSkipped = (conversion.skipped ?? []).filter(
      (entry: { ignored?: boolean }) => !entry.ignored,
    );
    initialWarnings.push(
      ...(conversion.skipped ?? [])
        .filter(
          (entry: { ignored?: boolean; collision?: unknown }) =>
            entry.ignored && entry.collision,
        )
        .map((entry: { reason?: string }) => ({
          code: "source_collision_resolved",
          message:
            entry.reason ??
            "Uma colisão de fontes foi resolvida pelo modifiedTime do Drive.",
        })),
    );
    const panelFile = conversion.panelLayerFiles?.find(
      (entry: { panelLayerId?: string }) =>
        entry.panelLayerId === config.panelLayerId,
    );

    if (!panelFile) {
      initialErrors.push({
        code: "panel_conversion_failed",
        message:
          "Não foi possível gerar os dados do painel a partir das fontes selecionadas.",
      });
    }
    initialErrors.push(
      ...blockingSkipped.map(
        (entry: { reason?: string; inputPath?: string }) => ({
          code: "csv_conversion_failed",
          message: entry.reason ?? "Falha ao converter CSV.",
        }),
      ),
    );

    if (initialErrors.length > 0 || !panelFile) {
      const validation = createValidationReport(config, {
        errors: initialErrors,
        warnings: initialWarnings,
        periods: configuredPeriods,
        locations: 0,
        municipalLocations: 0,
      });
      throw Object.assign(new Error("Conversão dos arquivos falhou."), {
        validation,
      });
    }

    const panelLayerImageData = JSON.parse(
      await readFile(panelFile.outputPath, "utf8"),
    ) as IndexCatalogBuildResult["panelLayerImageData"];
    const mapVisualization = finalizeContinuousVisualization(
      config,
      panelLayerImageData,
    );
    panelLayerImageData.mapVisualization = mapVisualization;
    panelLayerImageData.valueConfig = {
      type: config.valueType,
      unit: config.unit,
    };
    const panelLayerImageDataBytes = Buffer.byteLength(
      JSON.stringify(panelLayerImageData),
    );
    if (
      panelLayerImageDataBytes >
      basePipelineConfig.limits.maxContentfulJsonBytes
    ) {
      initialErrors.push({
        code: "panel_payload_too_large",
        message: `O payload do panelLayer possui ${panelLayerImageDataBytes} bytes e excede o limite de ${basePipelineConfig.limits.maxContentfulJsonBytes}.`,
      });
    }
    const contractErrors = validatePanelLayerImageData(
      panelLayerImageData,
      panelFile.outputPath,
    );
    initialErrors.push(
      ...contractErrors.map((message: string) => ({
        code: "image_data_contract",
        message,
      })),
    );

    const partitions = await Promise.all(
      (conversion.partitionFiles ?? []).map(
        async (partition: {
          partitionKey: string;
          calendarYear?: string;
          territory: string;
          outputPath: string;
          locationCount?: number;
        }) => ({
          partitionKey: partition.partitionKey,
          calendarYear: partition.calendarYear,
          territory: partition.territory,
          locationCount: partition.locationCount ?? 0,
          imageData: JSON.parse(await readFile(partition.outputPath, "utf8")),
        }),
      ),
    );
    const periods = Object.keys(panelLayerImageData.years).sort();
    const validation = createValidationReport(config, {
      errors: initialErrors,
      warnings: initialWarnings,
      periods,
      locations: Object.keys(panelLayerImageData.locations ?? {}).length,
      municipalLocations: Math.max(
        0,
        ...partitions.map((partition) => partition.locationCount),
      ),
      imageDataBytes: panelLayerImageDataBytes,
    });

    if (!validation.valid) {
      throw Object.assign(new Error("Validação final falhou."), {
        validation,
      });
    }

    return {
      panelLayerImageData,
      partitions: partitions.map((partition) => ({
        partitionKey: partition.partitionKey,
        calendarYear: partition.calendarYear,
        territory: partition.territory,
        imageData: partition.imageData,
      })),
      validation,
      mapVisualization,
    };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

export function getCatalogBuildValidation(error: unknown) {
  if (error && typeof error === "object" && "validation" in error) {
    return (error as { validation: CatalogValidationReport }).validation;
  }

  return null;
}
