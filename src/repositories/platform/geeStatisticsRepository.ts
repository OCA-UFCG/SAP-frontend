import "server-only";

import ee from "@google/earthengine";
import { getGeeStatisticsSource } from "@/config/geeStatistics";
import {
  getGeeStatisticsRequestedProperties,
  inferGeeStatisticsSchema,
  resolveGeeStatisticsSource,
} from "@/contracts/geeStatistics";
import type {
  GeeFeatureCollectionStatisticsSource,
  GeeStatisticsSchema,
  GeeStatisticsSource,
  PublishedGeeStatisticsSource,
  ResolvedGeeStatisticsSource,
} from "@/contracts/geeStatistics";
import {
  isGeeMunicipalValueTableSource,
  type GeeMunicipalValueTableStatisticsSource,
} from "@/contracts/geeMunicipalValueTable";
import { getMunicipalValueTableYearPatch } from "@/repositories/platform/geeMunicipalValueTableRepository";
import { buildSpatialLocationKey } from "@/contracts/spatialLocationKey.mjs";
import {
  evaluateGeeObject,
  initializeGee,
} from "@/infrastructure/earth-engine/client";
import {
  buildStatisticsRowsCacheKey,
  getOrLoadStatisticsRows,
} from "@/repositories/platform/geeStatisticsRowsCache";
import {
  readStatisticsSeries,
  setMergedCollectionsEvaluator,
  STATISTICS_OWNER_PROPERTY,
} from "@/repositories/platform/geeStatisticsSeriesBatcher";
import { resolveGeeStateCode, STATE_KEY_PATTERN } from "@/utils/geeStateCode";
import {
  MUNICIPALITY_KEY_PATTERN,
  shouldIncludeLocation,
} from "@/utils/statisticsLocationScope";
import type { CompactTerritorialAnalysisDatasetPatch } from "@/utils/municipalAnalysisMerge";
import { statesObj } from "@/utils/constants";

const AGGREGATE_LOCATION_PATTERN = /^(2_regiao|3_bioma|4_asd|5_semiarido)-/u;

const SOURCE_LEVEL_BY_LOCATION_PREFIX: Record<string, string> = {
  "2_regiao": "2_Regiao",
  "3_bioma": "3_Bioma",
  "4_asd": "4_ASD",
  "5_semiarido": "5_Semiarido",
};
const PERCENTAGE_SUM_TOLERANCE = 0.2;
// Quantos assets da série podem ser tentados como amostra do schema antes de a
// leitura desistir. O teto existe porque a tentativa é sequencial: numa queda
// geral do Earth Engine, percorrer os 45 anos do índice de aridez somaria 45
// idas fracassadas antes de responder ao usuário.
const SCHEMA_ASSET_CANDIDATES = 3;

interface EvaluatedFeature {
  properties?: Record<string, unknown>;
}

interface EvaluatedFeatureCollection {
  features?: EvaluatedFeature[];
}

const propertyNamesBySourceRevision = new Map<string, Promise<string[]>>();

export interface GeeStatisticsMetrics {
  areaTotalHa?: number;
  classAreaHa?: number[];
  mean?: number;
  median?: number;
  mode?: number;
  min?: number;
  max?: number;
}

export interface GeeStatisticsYearResult {
  assetId: string;
  featureCount: number;
  omittedZeroValueLocationKeys: string[];
  patch: CompactTerritorialAnalysisDatasetPatch;
  metrics: Record<string, GeeStatisticsMetrics>;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function getStateCode(
  source: ResolvedGeeStatisticsSource,
  row: Record<string, unknown>,
): string | null {
  return resolveGeeStateCode(
    row[source.properties.stateCode],
    row[source.properties.locationName],
  );
}

function getLocation(
  source: ResolvedGeeStatisticsSource,
  row: Record<string, unknown>,
): { key: string; label: string } {
  const level = normalizeText(row[source.properties.level]);
  const locationName = normalizeText(row[source.properties.locationName]);

  if (level === "1_BR") {
    return { key: "br", label: "Brasil" };
  }

  if (level === "6_Estado") {
    const stateCode = getStateCode(source, row);

    if (!stateCode) {
      throw new Error(
        `Linha estadual do GEE sem UF reconhecida: ${locationName}`,
      );
    }

    return {
      key: stateCode,
      label: statesObj[stateCode as keyof typeof statesObj] ?? locationName,
    };
  }

  if (level === "7_Municipio") {
    const municipalityCode = normalizeText(
      row[source.properties.municipalityCode],
    );

    if (!MUNICIPALITY_KEY_PATTERN.test(municipalityCode)) {
      throw new Error(
        `Linha municipal do GEE sem CD_MUN válido: ${municipalityCode || locationName}`,
      );
    }

    const stateCode = getStateCode(source, row)?.toUpperCase();
    return {
      key: municipalityCode,
      label: stateCode ? `${locationName} - ${stateCode}` : locationName,
    };
  }

  return {
    key: buildSpatialLocationKey(level, locationName),
    label: locationName,
  };
}

function toFiniteNumber(value: unknown, context: string): number {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Valor estatístico inválido em ${context}.`);
  }

  return parsed;
}

function toOptionalFiniteNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getMetrics(
  source: ResolvedGeeStatisticsSource,
  schema: GeeStatisticsSchema,
  row: Record<string, unknown>,
): GeeStatisticsMetrics {
  const classAreaHa = schema.classAreaProperties.map((property) =>
    toOptionalFiniteNumber(row[property]),
  );
  const scalarMetrics = source.properties.scalarMetrics;

  if (
    classAreaHa.some((value) => value !== undefined) &&
    classAreaHa.some((value) => value === undefined)
  ) {
    throw new Error(
      `Linha do asset estatístico ${source.assetId} possui áreas de classe incompletas.`,
    );
  }

  return {
    areaTotalHa: toOptionalFiniteNumber(row[source.properties.totalArea]),
    ...(classAreaHa.some((value) => value !== undefined)
      ? { classAreaHa: classAreaHa as number[] }
      : {}),
    ...(scalarMetrics?.mean
      ? { mean: toOptionalFiniteNumber(row[scalarMetrics.mean]) }
      : {}),
    ...(scalarMetrics?.median
      ? { median: toOptionalFiniteNumber(row[scalarMetrics.median]) }
      : {}),
    ...(scalarMetrics?.mode
      ? { mode: toOptionalFiniteNumber(row[scalarMetrics.mode]) }
      : {}),
    ...(scalarMetrics?.min
      ? { min: toOptionalFiniteNumber(row[scalarMetrics.min]) }
      : {}),
    ...(scalarMetrics?.max
      ? { max: toOptionalFiniteNumber(row[scalarMetrics.max]) }
      : {}),
  };
}

function validatePercentageDistribution(
  source: ResolvedGeeStatisticsSource,
  locationKey: string,
  yearKey: string,
  values: number[],
): boolean {
  if (values.some((value) => value < 0 || value > 100)) {
    throw new Error(
      `Asset estatístico ${source.assetId} possui percentual fora do intervalo 0–100 em ${locationKey}/${yearKey}.`,
    );
  }

  const isAllZero = values.every((value) => value === 0);
  const sum = values.reduce((total, value) => total + value, 0);

  if (!isAllZero && Math.abs(sum - 100) > PERCENTAGE_SUM_TOLERANCE) {
    throw new Error(
      `Asset estatístico ${source.assetId} possui percentuais que somam ${sum} em ${locationKey}/${yearKey}; esperado 100 ± ${PERCENTAGE_SUM_TOLERANCE}.`,
    );
  }

  return !isAllZero;
}

export function mapGeeStatisticsRows(
  source: ResolvedGeeStatisticsSource,
  schema: GeeStatisticsSchema,
  yearKey: string,
  requestedLocationKey: string,
  rows: Record<string, unknown>[],
  classCount: number,
): GeeStatisticsYearResult {
  if (schema.percentageProperties.length !== classCount) {
    throw new Error(
      `Asset estatístico ${source.assetId} possui ${schema.percentageProperties.length} classes, mas a camada possui ${classCount}.`,
    );
  }

  const locations: Record<string, string> = {};
  const values: Record<string, number[]> = {};
  const metrics: Record<string, GeeStatisticsMetrics> = {};
  const omittedZeroValueLocationKeys: string[] = [];
  const seenLocationKeys = new Set<string>();

  for (const row of rows) {
    const location = getLocation(source, row);

    if (!shouldIncludeLocation(requestedLocationKey, location.key)) {
      continue;
    }

    if (seenLocationKeys.has(location.key)) {
      throw new Error(
        `Asset estatístico ${source.assetId} possui localidade duplicada: ${location.key}/${yearKey}.`,
      );
    }
    seenLocationKeys.add(location.key);
    locations[location.key] = location.label;
    metrics[location.key] = getMetrics(source, schema, row);

    const locationValues = schema.percentageProperties.map((property) =>
      toFiniteNumber(row[property], `${location.key}/${yearKey}/${property}`),
    );

    if (
      !validatePercentageDistribution(
        source,
        location.key,
        yearKey,
        locationValues,
      )
    ) {
      omittedZeroValueLocationKeys.push(location.key);
      continue;
    }

    values[location.key] = locationValues;
  }

  return {
    assetId: source.assetId,
    featureCount: rows.length,
    omittedZeroValueLocationKeys,
    patch: {
      locations,
      years: {
        [yearKey]: {
          valuesScale: 1,
          values,
        },
      },
    },
    metrics,
  };
}

/**
 * A identidade da série inteira, e não a de um período. Uma fonte
 * `period-template` resolve um `assetId` diferente por período, então usar o
 * asset resolvido como chave de cache criava uma entrada por ano.
 */
function getStatisticsSeriesKey(
  source: GeeFeatureCollectionStatisticsSource,
): string {
  return source.asset.type === "fixed"
    ? source.asset.assetId
    : source.asset.assetIdTemplate;
}

/**
 * Os assets distintos que cobrem os períodos publicados, em ordem estável.
 *
 * Costuma ser bem menor que a lista de períodos: o template do Monitor de Secas
 * da ANA é anual e a granularidade é mensal, então os 30 períodos moram em 3
 * assets. Numa fonte `fixed` a lista tem sempre um item só.
 *
 * @example
 * resolveSeriesAssetIds(source, ["2020", "2021"], "projects/x/t_2020");
 * // ["projects/x/t_2020", "projects/x/t_2021"]
 */
function resolveSeriesAssetIds(
  source: GeeFeatureCollectionStatisticsSource,
  periodKeys: readonly string[],
  requestedAssetId: string,
): string[] {
  const assetIds = new Set<string>([requestedAssetId]);

  for (const periodKey of periodKeys) {
    try {
      assetIds.add(resolveGeeStatisticsSource(source, periodKey).assetId);
    } catch {
      // Um período publicado incompatível com a granularidade da fonte é um
      // problema daquele período: ele falha sozinho quando o painel o pede, e
      // não pode derrubar a leitura de todos os outros.
    }
  }

  return [...assetIds].sort();
}

function getAggregateLevel(locationKey: string): string | null {
  const prefix = locationKey.match(AGGREGATE_LOCATION_PATTERN)?.[1];
  return prefix ? (SOURCE_LEVEL_BY_LOCATION_PREFIX[prefix] ?? null) : null;
}

function buildLocationFilter(
  source: ResolvedGeeStatisticsSource,
  locationKey: string,
) {
  if (locationKey === "br") {
    return ee.Filter.or(
      ee.Filter.eq(source.properties.level, "1_BR"),
      ee.Filter.eq(source.properties.level, "6_Estado"),
    );
  }

  if (MUNICIPALITY_KEY_PATTERN.test(locationKey)) {
    return ee.Filter.and(
      ee.Filter.eq(source.properties.level, "7_Municipio"),
      ee.Filter.eq(source.properties.municipalityCode, locationKey),
    );
  }

  if (STATE_KEY_PATTERN.test(locationKey) && locationKey in statesObj) {
    // Some tables store the state name instead of its acronym in NM_UF. The
    // state slice has only 27 rows, so selecting the requested state after the
    // evaluation keeps the query small without coupling it to that convention.
    return ee.Filter.eq(source.properties.level, "6_Estado");
  }

  const aggregateLevel = getAggregateLevel(locationKey);
  if (aggregateLevel) {
    return ee.Filter.eq(source.properties.level, aggregateLevel);
  }

  throw new Error(`Chave territorial GEE inválida: ${locationKey}.`);
}

/**
 * A ordem em que os assets da série são tentados como amostra do schema: o do
 * período pedido primeiro, depois os mais recentes.
 *
 * `assetIds` chega ordenado por nome, e o nome de um `period-template` termina
 * no período — por isso o mais recente é o último.
 */
function getSchemaAssetCandidates(
  source: ResolvedGeeStatisticsSource,
  seriesAssetIds: readonly string[],
): string[] {
  const candidates = new Set<string>([source.assetId]);

  for (const assetId of [...seriesAssetIds].reverse()) {
    if (candidates.size >= SCHEMA_ASSET_CANDIDATES) break;
    candidates.add(assetId);
  }

  return [...candidates];
}

/**
 * As colunas da série, lidas do primeiro asset que responder.
 *
 * Todos os assets de um índice têm as mesmas colunas — o catálogo valida isso
 * ao publicar —, então qualquer um serve de amostra. Insistir no asset do
 * período pedido fazia um asset ilegível sozinho (uma reingestão em andamento,
 * por exemplo) derrubar a camada inteira, inclusive os anos que estavam no ar.
 */
async function loadSeriesPropertyNames(
  assetIds: readonly string[],
): Promise<string[]> {
  let firstError: unknown;

  for (const assetId of assetIds) {
    try {
      const collection = ee.FeatureCollection(assetId);
      const propertyNames = await evaluateGeeObject<string[]>(
        ee.Feature(collection.first()).propertyNames(),
      );

      if (Array.isArray(propertyNames)) return propertyNames;

      firstError ??= new Error(
        `Não foi possível identificar o schema do asset estatístico ${assetId}.`,
      );
    } catch (error) {
      firstError ??= error;
    }
  }

  throw (
    firstError ??
    new Error(
      `Nenhum asset estatístico informado para identificar o schema da série.`,
    )
  );
}

async function getGeeStatisticsSchema(
  source: ResolvedGeeStatisticsSource,
  sourceRevision?: string,
  seriesAssetIds: readonly string[] = [],
): Promise<GeeStatisticsSchema> {
  // A chave é a série, não o asset do período. O catálogo valida que todas as
  // tabelas de um índice têm o mesmo conjunto de colunas, então ler o schema de
  // uma responde por todas; antes eram 45 `propertyNames()` ao abrir o índice
  // de aridez do ERA5-Land, um por ano, além das 45 leituras de linhas.
  const cacheKey = `${sourceRevision ?? "legacy"}::${getStatisticsSeriesKey(source)}`;
  let propertyNamesPromise = propertyNamesBySourceRevision.get(cacheKey);
  if (!propertyNamesPromise) {
    propertyNamesPromise = loadSeriesPropertyNames(
      getSchemaAssetCandidates(source, seriesAssetIds),
    );
    propertyNamesBySourceRevision.set(cacheKey, propertyNamesPromise);
  }

  try {
    return inferGeeStatisticsSchema(source, await propertyNamesPromise);
  } catch (error) {
    propertyNamesBySourceRevision.delete(cacheKey);
    throw error;
  }
}

/**
 * A sub-coleção de um asset: filtrada pelo território, reduzida às colunas
 * pedidas e marcada com o número do pedido.
 *
 * A marcação existe porque a leitura viaja junto com a de outras camadas: sem
 * ela, a resposta conjunta não diria de qual série cada linha veio.
 */
function buildAssetRowsCollection(
  assetId: string,
  properties: string[],
  locationFilter: unknown,
  ownerTag: number,
) {
  return ee
    .FeatureCollection(assetId)
    .filter(locationFilter)
    .map((feature: unknown) =>
      ee.Feature(
        null,
        ee
          .Feature(feature)
          .toDictionary(properties)
          .set(STATISTICS_OWNER_PROPERTY, ownerTag),
      ),
    );
}

/**
 * Como as sub-coleções enfileiradas viram uma resposta.
 *
 * `ee.FeatureCollection([...]).flatten()` junta os recortes antes de avaliar,
 * então tudo o que entrou no pedido volta na mesma resposta e no mesmo formato
 * de um asset sozinho. É essa junção que faz o preço parar de acompanhar o
 * número de períodos — e agora o de camadas: cada ida ao Earth Engine custa
 * cerca de um segundo qualquer que seja o tamanho do que se pede.
 */
setMergedCollectionsEvaluator(async (collections, assetIds) => {
  const merged = ee.FeatureCollection([...collections]).flatten();
  const result = await evaluateGeeObject<EvaluatedFeatureCollection>(merged);

  if (!Array.isArray(result?.features)) {
    throw new Error(
      `Resposta inválida do asset estatístico GEE ${assetIds.join(", ")}.`,
    );
  }

  return result.features.map((feature) => feature.properties ?? {});
});

/**
 * Todas as linhas da série estatística para um território, sem filtrar por
 * período.
 *
 * O filtro territorial fica no Earth Engine porque é ele que limita o tamanho
 * da resposta: sem ele viriam as 5.573 linhas municipais. O filtro de período
 * não limita nada — ler um mês do asset do ANA custou 2436 ms e ler os doze
 * meses do mesmo ano custou 2423 ms, porque o preço é do round trip, não do
 * volume. Filtrar por período aqui fazia o painel gastar uma ida ao Earth
 * Engine por período visível ao abrir a camada.
 */
async function loadSeriesLocationRows(
  source: ResolvedGeeStatisticsSource,
  assetIds: readonly string[],
  properties: string[],
  locationKey: string,
): Promise<Record<string, unknown>[]> {
  const locationFilter = buildLocationFilter(source, locationKey);
  // Sem limitador de concorrência de propósito: o SDK do Earth Engine já
  // despacha uma requisição a cada 350 ms de uma fila global do processo, então
  // um limitador aqui só somaria espera à espera que já existe.
  const { rows, unavailableAssetIds, firstError } = await readStatisticsSeries(
    assetIds.map((assetId) => ({
      assetId,
      buildCollection: (ownerTag: number) =>
        buildAssetRowsCollection(assetId, properties, locationFilter, ownerTag),
    })),
  );

  // Quando nenhum asset responde não é um período que falta, é a fonte que está
  // fora: o erro sobe como antes, porque uma série vazia devolvida em silêncio
  // viraria "sem dados" em toda a camada, sem ninguém notar.
  if (unavailableAssetIds.length === assetIds.length) {
    throw (
      firstError ??
      new Error(
        `Nenhum asset estatístico da série respondeu para ${locationKey}: ${assetIds.join(", ")}.`,
      )
    );
  }

  return rows;
}

/**
 * Seleciona o período entre as linhas já carregadas do território.
 *
 * `data_img` guarda o primeiro dia do mês (`2025-06-01`) nas fontes mensais, e
 * `ano` guarda o ano como número nas anuais. Errar essa correspondência faz o
 * painel mostrar o período errado sem nenhum erro, então ela tem teste próprio.
 */
export function matchesStatisticsPeriod(
  source: ResolvedGeeStatisticsSource,
  row: Record<string, unknown>,
  yearKey: string,
): boolean {
  if (source.periodGranularity === "month") {
    return row[source.properties.date] === `${yearKey}-01`;
  }

  return Number(row[source.properties.year]) === Number(yearKey);
}

async function loadGeeStatisticsRows(
  source: ResolvedGeeStatisticsSource,
  schema: GeeStatisticsSchema,
  assetIds: readonly string[],
  yearKey: string,
  locationKey: string,
): Promise<Record<string, unknown>[]> {
  const properties = getGeeStatisticsRequestedProperties(source, schema);
  // Uma série lida sem um asset indisponível também é cacheada: o asset que
  // voltar entra na próxima leitura, até 10 minutos depois (o TTL deste cache).
  const rows = await getOrLoadStatisticsRows(
    buildStatisticsRowsCacheKey(assetIds, locationKey, properties),
    () => loadSeriesLocationRows(source, assetIds, properties, locationKey),
  );

  return rows.filter((row) => matchesStatisticsPeriod(source, row, yearKey));
}

/**
 * A tabela municipal de valor único adaptada ao mesmo resultado das tabelas
 * classificatórias.
 *
 * A camada precisa ter exatamente uma classe — o indicador em si —, porque o
 * asset traz um número por município e não uma distribuição. Conferir isso aqui
 * evita um painel que soma um vetor de um valor em cima de uma legenda de seis.
 */
async function readMunicipalValueTablePatch(
  source: GeeMunicipalValueTableStatisticsSource,
  yearKey: string,
  locationKey: string,
  classCount: number,
  periodKeys: readonly string[],
): Promise<GeeStatisticsYearResult> {
  if (classCount !== 1) {
    throw new Error(
      `A camada possui ${classCount} classes, mas uma tabela municipal de valor único produz uma só.`,
    );
  }

  const result = await getMunicipalValueTableYearPatch(
    source,
    yearKey,
    locationKey,
    periodKeys,
  );

  return {
    assetId: result.assetIds.join(", "),
    featureCount: Object.keys(result.patch.locations ?? {}).length,
    omittedZeroValueLocationKeys: [],
    patch: result.patch,
    metrics: {},
  };
}

/**
 * O patch territorial de um período, lendo a série inteira de uma vez.
 *
 * `periodKeys` são todos os períodos publicados da camada. Quando vem
 * preenchido, a leitura cobre a série toda em um punhado de pedidos e os demais
 * períodos saem do cache — é o que faz abrir o painel custar uma ida ao Earth
 * Engine em vez de uma por período. Sem ele o comportamento é o antigo, e a
 * leitura cobre só o período pedido.
 *
 * @example
 * await getGeeStatisticsYearPatch("indicearidez", "2020", "br", 5, source, [
 *   "2019",
 *   "2020",
 * ]);
 */
export async function getGeeStatisticsYearPatch(
  panelLayerId: string,
  yearKey: string,
  locationKey: string,
  classCount: number,
  explicitSource?: PublishedGeeStatisticsSource | GeeStatisticsSource | null,
  periodKeys: readonly string[] = [],
): Promise<GeeStatisticsYearResult | null> {
  const source = explicitSource ?? getGeeStatisticsSource(panelLayerId);

  if (!source) {
    return null;
  }

  await initializeGee();

  if (isGeeMunicipalValueTableSource(source)) {
    return readMunicipalValueTablePatch(
      source,
      yearKey,
      locationKey,
      classCount,
      periodKeys,
    );
  }

  const resolvedSource = resolveGeeStatisticsSource(source, yearKey);
  const seriesAssetIds = resolveSeriesAssetIds(
    source,
    periodKeys,
    resolvedSource.assetId,
  );
  const schema = await getGeeStatisticsSchema(
    resolvedSource,
    "sourceRevision" in source && typeof source.sourceRevision === "string"
      ? source.sourceRevision
      : undefined,
    seriesAssetIds,
  );

  if (schema.percentageProperties.length !== classCount) {
    throw new Error(
      `Asset estatístico ${resolvedSource.assetId} possui ${schema.percentageProperties.length} classes, mas a camada possui ${classCount}.`,
    );
  }

  const rows = await loadGeeStatisticsRows(
    resolvedSource,
    schema,
    seriesAssetIds,
    yearKey,
    locationKey,
  );
  return mapGeeStatisticsRows(
    resolvedSource,
    schema,
    yearKey,
    locationKey,
    rows,
    classCount,
  );
}

export function clearGeeStatisticsSchemaCacheForTests(): void {
  propertyNamesBySourceRevision.clear();
}

export function clearGeeStatisticsSchemaCache(sourceRevision?: string): void {
  if (!sourceRevision) {
    propertyNamesBySourceRevision.clear();
    return;
  }
  const prefix = `${sourceRevision}::`;
  for (const key of propertyNamesBySourceRevision.keys()) {
    if (key.startsWith(prefix)) propertyNamesBySourceRevision.delete(key);
  }
}
