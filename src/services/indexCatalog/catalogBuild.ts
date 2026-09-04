import "server-only";

import ee from "@google/earthengine";
import { createHash } from "node:crypto";
import {
  inferGeeStatisticsSchema,
  type GeeFeatureCollectionStatisticsSource,
  type GeeStatisticsSchema,
  type PublishedGeeStatisticsSource,
  type ResolvedGeeStatisticsSource,
} from "@/contracts/geeStatistics";
import {
  inspectEarthEngineAsset,
  listEarthEngineAssets,
} from "@/app/api/ee/services";
import {
  evaluateGeeObject,
  initializeGee,
} from "@/infrastructure/earth-engine/client";
import {
  buildStatisticsAssetKey,
  getOrValidateStatisticsAsset,
  isStatisticsAssetCached,
  type DiscoveredStatisticsAsset,
} from "@/services/indexCatalog/statisticsAssetCache";
import {
  readStatisticsAssetProbes,
  readStatisticsAssetProperties,
  type StatisticsAssetProbe,
} from "@/services/indexCatalog/statisticsAssetProbe";
import {
  countInvalidPercentageRows,
  parsePercentageColumns,
} from "@/utils/catalogPercentageRows";
import type {
  CatalogValidationReport,
  ClassMapping,
  EarthEngineAssetMapping,
  IndexCatalogBuildResult,
  IndexCatalogConfigV2,
} from "@/types/indexCatalog";
import { expandAssetForPeriod, inferTimeScale } from "@/utils/indexCatalog";

const PERIOD_PATTERN = /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/u;
const PERCENTAGE_TOLERANCE = 0.2;
const DEFAULT_CLASS_COLORS = [
  "#D9ED92",
  "#B5E48C",
  "#76C893",
  "#34A0A4",
  "#1A759F",
  "#184E77",
];

interface ValidatedForecastCollection {
  latestValue: string | number;
  leadByPeriod: Record<string, number>;
}

interface ValidatedMapAssets {
  assets: Array<{ assetId: string; updateTime?: string }>;
  forecast?: ValidatedForecastCollection;
}

export interface CatalogStatisticsDiscovery {
  assets: DiscoveredStatisticsAsset[];
  periods: string[];
  classIndexes: number[];
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizePeriod(
  value: unknown,
  granularity: GeeFeatureCollectionStatisticsSource["periodGranularity"],
) {
  if (granularity === "year") {
    const year = String(value ?? "").match(/\d{4}/u)?.[0] ?? "";
    return /^\d{4}$/u.test(year) ? year : null;
  }
  const date = String(value ?? "").trim();
  const period = date.match(/^\d{4}-(?:0[1-9]|1[0-2])/u)?.[0] ?? "";
  return PERIOD_PATTERN.test(period) ? period : null;
}

function templatePattern(template: string) {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    `^${escaped
      .replaceAll("\\{year\\}", "\\d{4}")
      .replaceAll("\\{month\\}", "(?:0[1-9]|1[0-2])")
      .replaceAll("\\{period\\}", "\\d{4}(?:-(?:0[1-9]|1[0-2]))?")}$`,
    "u",
  );
}

interface StatisticsAssetCandidate {
  id: string;
  /**
   * Só o que entra no `sourceRevision` do índice publicado. Mantido igual ao
   * que a versão anterior gravava, para uma prévia validada antes desta
   * mudança continuar passando na conferência de impressão digital da
   * publicação.
   */
  updateTime?: string;
  /** Carimbo de revisão usado apenas como chave da memoização. */
  revision?: string;
}

async function getStatisticsAssetIds(
  source: GeeFeatureCollectionStatisticsSource,
): Promise<StatisticsAssetCandidate[]> {
  if (source.asset.type === "fixed") {
    // O tipo do asset é conferido aqui porque, ao contrário do caminho por
    // template, não existe listagem que já garanta que ele é uma tabela.
    const assetId = source.asset.assetId;
    const inspection = await inspectEarthEngineAsset(assetId);
    if (inspection.type !== "featureCollection") {
      throw new Error(
        `O asset estatístico ${assetId} é ${inspection.type}; esperado FeatureCollection.`,
      );
    }
    return [
      {
        id: assetId,
        updateTime: inspection.updateTime,
        // O `getAsset` não devolve `updateTime` em nenhum asset que medimos, e
        // sem carimbo a memoização nunca engatava num asset fixo. O `version`
        // vem sempre, e é o mesmo instante em microssegundos.
        revision: inspection.updateTime ?? inspection.version,
      },
    ];
  }

  const template = source.asset.assetIdTemplate;
  const separator = template.lastIndexOf("/");
  if (separator < 1) {
    throw new Error("O template estatístico precisa ter um diretório-pai.");
  }
  const parent = template.slice(0, separator);
  const pattern = templatePattern(template);
  const assets = (await listEarthEngineAssets(parent)).filter(
    (asset) => pattern.test(asset.id) && asset.type.toUpperCase() === "TABLE",
  );
  if (assets.length === 0) {
    throw new Error(
      `Nenhuma FeatureCollection corresponde ao template ${template}.`,
    );
  }
  // A listagem do diretório-pai já respondeu o tipo e o `updateTime` de todas
  // as tabelas de uma vez. Um `getAsset` por tabela só repetiria isso: eram
  // 35 idas e voltas (39 s medidos) sem nenhuma garantia nova.
  return assets.map(({ id, updateTime }) => ({
    id,
    updateTime,
    revision: updateTime,
  }));
}

function resolvedSource(
  source: GeeFeatureCollectionStatisticsSource,
  assetId: string,
): ResolvedGeeStatisticsSource {
  return { ...source, assetId };
}

interface PlannedStatisticsAsset {
  source: ResolvedGeeStatisticsSource;
  updateTime?: string;
  key?: string;
}

interface PendingStatisticsReading {
  schema: GeeStatisticsSchema;
  probe: StatisticsAssetProbe;
}

function validateProbedRows(
  source: ResolvedGeeStatisticsSource,
  schema: GeeStatisticsSchema,
  probe: StatisticsAssetProbe,
) {
  const rowCount = probe.rowCount;
  if (!rowCount) {
    throw new Error(`Asset estatístico ${source.assetId} não possui linhas.`);
  }
  if (probe.completeCount !== rowCount) {
    throw new Error(
      `Asset estatístico ${source.assetId} possui ${rowCount - probe.completeCount} linha(s) com campos obrigatórios vazios.`,
    );
  }
  if (probe.completeMunicipalCount !== probe.municipalCount) {
    throw new Error(
      `Asset estatístico ${source.assetId} possui município(s) sem CD_MUN ou UF.`,
    );
  }
  if (probe.completeStateCount !== probe.stateCount) {
    throw new Error(
      `Asset estatístico ${source.assetId} possui estado(s) sem propriedade de UF.`,
    );
  }
  if (probe.distinctCount !== rowCount) {
    throw new Error(
      `Asset estatístico ${source.assetId} possui ${rowCount - probe.distinctCount} território(s)/período(s) duplicado(s).`,
    );
  }
  // Depois das checagens de nulo: uma coluna com valor ausente sai mais curta de
  // reduceColumns, e o erro de campo obrigatório vazio explica melhor a causa.
  const invalidPercentageCount = countInvalidPercentageRows(
    parsePercentageColumns(
      probe.percentageColumns,
      schema.percentageProperties,
      rowCount,
      source.assetId,
    ),
    PERCENTAGE_TOLERANCE,
  );
  if (invalidPercentageCount > 0) {
    throw new Error(
      `Asset estatístico ${source.assetId} possui ${invalidPercentageCount} linha(s) com percentuais fora de 0–100 ou sem total 100 ± ${PERCENTAGE_TOLERANCE}.`,
    );
  }

  return rowCount;
}

function probedPeriods(
  source: ResolvedGeeStatisticsSource,
  probe: StatisticsAssetProbe,
) {
  const property =
    source.periodGranularity === "month"
      ? source.properties.date
      : source.properties.year;
  const periods = [
    ...new Set(
      (probe.periods ?? []).flatMap((value) => {
        const period = normalizePeriod(value, source.periodGranularity);
        return period ? [period] : [];
      }),
    ),
  ].sort();
  if (periods.length === 0) {
    throw new Error(
      `Asset estatístico ${source.assetId} não possui períodos válidos em ${property}.`,
    );
  }
  return periods;
}

/**
 * Lê em lote o schema e as linhas das tabelas que a memoização ainda não tem.
 *
 * São dois pedidos ao Earth Engine para o conjunto todo: um traz as colunas de
 * cada tabela (é delas que sai o schema de classes) e o outro traz as contagens
 * e os percentuais, que dependem do schema descoberto no primeiro. Antes eram
 * 10 pedidos por tabela — 350 num índice de 35 anos.
 */
async function readPendingStatistics(
  pending: PlannedStatisticsAsset[],
): Promise<Map<string, PendingStatisticsReading>> {
  if (pending.length === 0) return new Map();

  const properties = await readStatisticsAssetProperties(
    pending.map((item) => item.source.assetId),
  );
  const requests = pending.map((item, index) => ({
    source: item.source,
    schema: inferGeeStatisticsSchema(item.source, properties[index]),
  }));
  const probes = await readStatisticsAssetProbes(requests);

  return new Map(
    requests.flatMap(({ source, schema }) => {
      const probe = probes.get(source.assetId);
      return probe ? [[source.assetId, { schema, probe }] as const] : [];
    }),
  );
}

async function discoverStatisticsAsset(
  planned: PlannedStatisticsAsset,
  batched: Promise<Map<string, PendingStatisticsReading>>,
): Promise<DiscoveredStatisticsAsset> {
  const { source, updateTime } = planned;
  // A leitura em lote cobre as tabelas que a memoização não tinha. Uma entrada
  // memoizada pode ser descartada pelo teto do cache entre o planejamento do
  // lote e este ponto (num índice com mais tabelas que o teto), e nesse caso a
  // tabela é lida sozinha em vez de a validação falhar.
  const reading =
    (await batched).get(source.assetId) ??
    (await readPendingStatistics([planned])).get(source.assetId);
  if (!reading) {
    throw new Error(
      `O Earth Engine não devolveu a leitura do asset estatístico ${source.assetId}.`,
    );
  }
  // Períodos antes das linhas: um asset sem período válido tem uma causa mais
  // específica que "linha com campo vazio", e é a mensagem mais útil.
  const periods = probedPeriods(source, reading.probe);
  const rowCount = validateProbedRows(source, reading.schema, reading.probe);
  return {
    assetId: source.assetId,
    updateTime,
    schema: reading.schema,
    periods,
    rowCount,
  };
}

export async function discoverCatalogStatistics(
  source: GeeFeatureCollectionStatisticsSource,
): Promise<CatalogStatisticsDiscovery> {
  await initializeGee();
  const candidates = await getStatisticsAssetIds(source);
  // A chave da memoização sai do endereço e da revisão do asset, e não do
  // schema: por isso ela é montada antes de qualquer leitura, e uma tabela já
  // memoizada não custa nem a leitura das colunas.
  const planned: PlannedStatisticsAsset[] = candidates.map((candidate) => {
    const resolved = resolvedSource(source, candidate.id);
    return {
      source: resolved,
      updateTime: candidate.updateTime,
      key: buildStatisticsAssetKey(resolved, candidate.revision),
    };
  });
  // O lote é disparado antes do Promise.all: assim cada tabela já fica
  // registrada como "em voo" no cache, e duas prévias simultâneas do mesmo
  // rascunho compartilham a mesma leitura em vez de pedir tudo duas vezes.
  const batched = readPendingStatistics(
    planned.filter((item) => !isStatisticsAssetCached(item.key)),
  );
  const assets = await Promise.all(
    planned.map((item) =>
      getOrValidateStatisticsAsset(item.key, () =>
        discoverStatisticsAsset(item, batched),
      ),
    ),
  );

  const expectedIndexes = assets[0].schema.classIndexes;
  for (const asset of assets.slice(1)) {
    if (asset.schema.classIndexes.join(",") !== expectedIndexes.join(",")) {
      throw new Error(
        `O schema de classes de ${asset.assetId} diverge dos demais assets.`,
      );
    }
  }
  const periodOwners = new Map<string, string>();
  for (const asset of assets) {
    for (const period of asset.periods) {
      const owner = periodOwners.get(period);
      if (owner && owner !== asset.assetId) {
        throw new Error(
          `O período ${period} aparece em mais de um asset estatístico (${owner} e ${asset.assetId}).`,
        );
      }
      periodOwners.set(period, asset.assetId);
    }
  }

  return {
    assets,
    periods: [...periodOwners.keys()].sort(),
    classIndexes: expectedIndexes,
  };
}

/**
 * Casa o que o operador configurou com as classes que a tabela de estatísticas
 * realmente tem.
 *
 * O normal é casar por `classIndex`, porque num rascunho retomado ele já é o
 * número da coluna `perc_classe_XX`. Num formulário preenchido a partir de um
 * índice legado não é: a legenda vem do Contentful e só a tabela sabe se as
 * colunas são `perc_classe_0..5` ou `perc_classe_1..6`. Quando os dois conjuntos
 * divergem e a quantidade de classes bate, a posição é a informação confiável —
 * sem isso o v2 da previsão de anomalia nasceria com a primeira classe como
 * "Classe 0", num cinza padrão, e todas as cores deslocadas uma casa.
 *
 * `pixelValue` continua vindo do que foi configurado: ele é o código no raster,
 * e não tem obrigação de ser igual ao número da coluna.
 */
function buildClasses(
  configured: ClassMapping[],
  classIndexes: number[],
): ClassMapping[] {
  const configuredByIndex = new Map(
    configured.map((entry) => [entry.classIndex, entry]),
  );
  const matchByPosition =
    configured.length === classIndexes.length &&
    classIndexes.some((classIndex) => !configuredByIndex.has(classIndex));
  return classIndexes.map((classIndex, position) => {
    const existing = matchByPosition
      ? configured[position]
      : configuredByIndex.get(classIndex);
    return {
      classIndex,
      id: existing?.id || `classe-${classIndex}`,
      label: existing?.label || `Classe ${classIndex}`,
      color:
        existing?.color ??
        DEFAULT_CLASS_COLORS[position % DEFAULT_CLASS_COLORS.length],
      pixelValue: existing?.pixelValue ?? classIndex,
    };
  });
}

function buildMapVisualization(
  config: IndexCatalogConfigV2,
  classes: ClassMapping[],
  forecast?: ValidatedForecastCollection,
) {
  const pixels = classes.map((entry) => entry.pixelValue ?? entry.classIndex);
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
    min: Math.min(...pixels),
    max: Math.max(...pixels),
    palette: classes.map((entry) => entry.color),
    legend: classes.map((entry) => ({
      id: entry.id,
      label: entry.label,
      color: entry.color,
      pixelLimit: entry.pixelValue ?? entry.classIndex,
    })),
    ...(config.earthEngine.thresholds?.length
      ? { thresholds: config.earthEngine.thresholds }
      : {}),
    ...(forecast && config.earthEngine.collectionSelection
      ? {
          imageCollectionSelection: {
            latestProperty:
              config.earthEngine.collectionSelection.emissionProperty,
            latestValue: forecast.latestValue,
            filterProperty: config.earthEngine.collectionSelection.leadProperty,
            sortProperty: config.earthEngine.collectionSelection.leadProperty,
            selectFirstBand: true,
          },
        }
      : {}),
    ...(config.earthEngine.sourceType === "featureCollection"
      ? { outline: { color: "#000000", width: 0.5, opacity: 1 } }
      : {}),
  };
}

function normalizeForecastPeriod(value: unknown) {
  if (value == null) return null;
  if (typeof value === "string") {
    const directPeriod = value.match(/^\d{4}-(?:0[1-9]|1[0-2])/u)?.[0];
    if (directPeriod) return directPeriod;
  }

  const numeric = Number(value);
  if (Number.isInteger(numeric) && /^\d{8}$/u.test(String(numeric))) {
    const compactDate = String(numeric);
    const period = `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}`;
    return /^\d{4}-(?:0[1-9]|1[0-2])$/u.test(period) ? period : null;
  }
  const date = new Date(Number.isFinite(numeric) ? numeric : String(value));
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function validateForecastCollection(
  mapping: EarthEngineAssetMapping,
  periods: string[],
  assetId: string,
): Promise<ValidatedForecastCollection | undefined> {
  const selection = mapping.collectionSelection;
  if (!selection) return undefined;
  if (periods.some((period) => !/^\d{4}-\d{2}$/u.test(period))) {
    throw new Error(
      "Previsão por emissão e horizonte exige estatísticas mensais.",
    );
  }
  if (!mapping.band) {
    throw new Error("Previsão por emissão e horizonte exige uma banda.");
  }
  if (!mapping.thresholds?.length) {
    throw new Error(
      "Previsão por emissão e horizonte exige os limites das classes.",
    );
  }

  const collection = ee.ImageCollection(assetId);
  const emissionValues = await evaluateGeeObject<Array<string | number>>(
    collection.aggregate_array(selection.emissionProperty).distinct().sort(),
  );
  const latestValue = emissionValues?.at(-1);
  if (latestValue == null) {
    throw new Error(
      `A coleção ${assetId} não possui valores em ${selection.emissionProperty}.`,
    );
  }

  const latestCollection = collection
    .filter(ee.Filter.eq(selection.emissionProperty, latestValue))
    .sort(selection.leadProperty);
  const [rawLeads, rawTargetDates] = await Promise.all([
    evaluateGeeObject<unknown[]>(
      latestCollection.aggregate_array(selection.leadProperty),
    ),
    evaluateGeeObject<unknown[]>(
      latestCollection.aggregate_array(selection.targetDateProperty),
    ),
  ]);
  if (rawLeads.length !== rawTargetDates.length) {
    throw new Error(
      `A coleção ${assetId} retornou horizontes e datas em quantidades diferentes.`,
    );
  }

  const rows = rawLeads.map((rawLead, index) => ({
    lead: Number(rawLead),
    period: normalizeForecastPeriod(rawTargetDates[index]),
  }));
  const leadByPeriod: Record<string, number> = {};
  for (const expectedLead of selection.leadValues) {
    const matches = rows.filter((row) => row.lead === expectedLead);
    if (matches.length !== 1) {
      throw new Error(
        `A emissão ${latestValue} de ${assetId} deve possuir exatamente uma imagem com ${selection.leadProperty}=${expectedLead}.`,
      );
    }
    const period = matches[0].period;
    if (!period) {
      throw new Error(
        `A imagem do horizonte ${expectedLead} não possui uma data válida em ${selection.targetDateProperty}.`,
      );
    }
    if (leadByPeriod[period] != null) {
      throw new Error(
        `Mais de um horizonte da emissão ${latestValue} aponta para ${period}.`,
      );
    }
    leadByPeriod[period] = expectedLead;
  }

  const forecastPeriods = Object.keys(leadByPeriod).sort();
  const expectedPeriods = [...periods].sort();
  if (forecastPeriods.join(",") !== expectedPeriods.join(",")) {
    throw new Error(
      `Os períodos da emissão ${latestValue} (${forecastPeriods.join(", ")}) não correspondem aos períodos estatísticos (${expectedPeriods.join(", ")}).`,
    );
  }

  return { latestValue, leadByPeriod };
}

async function validateMapAssets(
  config: IndexCatalogConfigV2,
  periods: string[],
): Promise<ValidatedMapAssets> {
  const assets = new Map<string, string[]>();
  for (const period of periods) {
    const assetId = expandAssetForPeriod(config.earthEngine, period);
    if (!assetId) {
      throw new Error(`Não há asset de mapa para o período ${period}.`);
    }
    assets.set(assetId, [...(assets.get(assetId) ?? []), period]);
  }

  const metadata: Array<{ assetId: string; updateTime?: string }> = [];
  for (const [assetId, assetPeriods] of assets) {
    const inspection = await inspectEarthEngineAsset(assetId);
    if (inspection.type !== config.earthEngine.sourceType) {
      throw new Error(
        `O asset de mapa ${assetId} é ${inspection.type}, mas o formulário informa ${config.earthEngine.sourceType}.`,
      );
    }
    for (const period of assetPeriods) {
      const band = config.earthEngine.band
        ?.replaceAll("{period}", period)
        .replaceAll("{year}", period.slice(0, 4))
        .replaceAll("{month}", period.slice(5, 7));
      const property = config.earthEngine.property
        ?.replaceAll("{period}", period)
        .replaceAll("{year}", period.slice(0, 4))
        .replaceAll("{month}", period.slice(5, 7));
      if (band && !inspection.bands.includes(band)) {
        throw new Error(
          `A banda ${band} não existe em ${assetId} (${period}).`,
        );
      }
      if (property && !inspection.properties.includes(property)) {
        throw new Error(
          `A propriedade ${property} não existe em ${assetId} (${period}).`,
        );
      }
    }
    if (
      inspection.type === "featureCollection" &&
      !config.earthEngine.property
    ) {
      throw new Error("FeatureCollection de mapa exige uma propriedade.");
    }
    if (
      inspection.type !== "featureCollection" &&
      inspection.bands.length > 1 &&
      !config.earthEngine.band
    ) {
      throw new Error("Asset de mapa com várias bandas exige uma banda.");
    }
    metadata.push({ assetId, updateTime: inspection.updateTime });
  }
  const forecast = config.earthEngine.collectionSelection
    ? await validateForecastCollection(
        config.earthEngine,
        periods,
        config.earthEngine.singleAssetId ?? "",
      )
    : undefined;
  return { assets: metadata, ...(forecast ? { forecast } : {}) };
}

function buildValidationError(
  config: IndexCatalogConfigV2,
  error: unknown,
): Error & { validation: CatalogValidationReport } {
  const message = error instanceof Error ? error.message : String(error);
  return Object.assign(new Error(message), {
    validation: {
      validatedAt: new Date().toISOString(),
      valid: false,
      errors: [{ code: "asset_validation", message }],
      warnings: [],
      inferred: {
        panelLayerId: config.panelLayerId,
        periods: [],
        classIndexes: [],
        statisticsAssetCount: 0,
      },
      sourceFingerprint: "",
    } satisfies CatalogValidationReport,
  });
}

export async function buildCatalogDraft(
  config: IndexCatalogConfigV2,
): Promise<IndexCatalogBuildResult> {
  try {
    const discovery = await discoverCatalogStatistics(config.statisticsSource);
    const classes = buildClasses(config.classes, discovery.classIndexes);
    if (
      config.earthEngine.thresholds?.length &&
      config.earthEngine.thresholds.length !== classes.length - 1
    ) {
      throw new Error(
        `Informe exatamente ${Math.max(0, classes.length - 1)} limite(s) para separar as ${classes.length} classes.`,
      );
    }
    const mapAssets = await validateMapAssets(config, discovery.periods);
    const sourceRevision = hash({
      source: config.statisticsSource,
      assets: discovery.assets,
      periods: discovery.periods,
      classIndexes: discovery.classIndexes,
    });
    const statisticsSource: PublishedGeeStatisticsSource = {
      ...config.statisticsSource,
      schemaVersion: 1,
      sourceRevision,
    };
    const mapVisualization = buildMapVisualization(
      config,
      classes,
      mapAssets.forecast,
    );
    const years = Object.fromEntries(
      discovery.periods.map((period) => [
        period,
        {
          imageId: expandAssetForPeriod(config.earthEngine, period),
          ...(mapAssets.forecast
            ? { leadTime: mapAssets.forecast.leadByPeriod[period] }
            : {}),
          valuesScale: 1,
          values: {},
        },
      ]),
    );
    const panelLayerImageData = {
      schemaVersion: 1,
      type: "territorial-compact" as const,
      defaultYear: mapAssets.forecast
        ? discovery.periods[0]
        : discovery.periods.at(-1),
      classes: classes.map(({ id, label, color, pixelValue }) => ({
        id,
        label,
        color,
        pixelLimit: pixelValue,
      })),
      locations: { br: "Brasil" },
      templates: {
        country:
          "No Brasil, predomina a classe {label} com {value}% da área analisada.",
        state:
          "Em {name}, predomina a classe {label} com {value}% da área analisada.",
        municipality:
          "No município de {name}, predomina a classe {label} com {value}% da área analisada.",
        highlight: "Região maioritariamente {label}",
      },
      ranking: {
        title: "Estados por classe predominante",
        totalLabel: "Estados",
      },
      valueConfig: { type: "percentage" as const, unit: "%" },
      mapVisualization,
      years,
    };
    const imageDataBytes = Buffer.byteLength(
      JSON.stringify(panelLayerImageData),
    );
    const sourceFingerprint = hash({
      sourceRevision,
      mapAssets,
      classes,
      earthEngine: config.earthEngine,
      periods: discovery.periods,
    });
    const validation: CatalogValidationReport = {
      validatedAt: new Date().toISOString(),
      valid: true,
      errors: [],
      warnings: [],
      inferred: {
        panelLayerId: config.panelLayerId,
        periods: discovery.periods,
        defaultPeriod: discovery.periods.at(-1),
        timeScale: inferTimeScale(discovery.periods),
        classIndexes: discovery.classIndexes,
        statisticsAssetCount: discovery.assets.length,
        imageDataBytes,
      },
      sourceFingerprint,
    };

    return {
      panelLayerImageData,
      validation,
      mapVisualization,
      statisticsSource,
      classes,
    };
  } catch (error) {
    if (getCatalogBuildValidation(error)) throw error;
    throw buildValidationError(config, error);
  }
}

export function getCatalogBuildValidation(error: unknown) {
  if (error && typeof error === "object" && "validation" in error) {
    return (error as { validation: CatalogValidationReport }).validation;
  }
  return null;
}
