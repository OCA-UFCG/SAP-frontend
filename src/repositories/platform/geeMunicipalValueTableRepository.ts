import "server-only";

import ee from "@google/earthengine";
import {
  getGeeMunicipalValueTableProperties,
  resolveGeeMunicipalValueTableSource,
  type GeeMunicipalValueTableStatisticsSource,
} from "@/contracts/geeMunicipalValueTable";
import { evaluateGeeObject } from "@/infrastructure/earth-engine/client";
import {
  buildMunicipalityRow,
  buildStateRow,
  mapMunicipalValueRows,
  toSingleValuesByPeriod,
  toValuesByPeriod,
  MUNICIPALITY_KEY_PATTERN,
  type MunicipalValueRow,
} from "@/repositories/platform/geeMunicipalValueTable";
import {
  buildStatisticsRowsCacheKey,
  getOrLoadStatisticsRows,
} from "@/repositories/platform/geeStatisticsRowsCache";
import type { CompactTerritorialAnalysisDatasetPatch } from "@/utils/municipalAnalysisMerge";

/**
 * Um asset e as colunas de período que ele guarda.
 *
 * Numa FeatureCollection única — o caso dos dados socioeconômicos — existe um
 * plano só, com uma coluna por ano. Num template por período existe um plano por
 * asset, e a leitura junta os resultados.
 */
interface ValueTableReadPlan {
  assetId: string;
  periodKeys: string[];
  valueColumns: string[];
}

export interface MunicipalValueTableYearResult {
  patch: CompactTerritorialAnalysisDatasetPatch;
  assetIds: string[];
}

interface StateGroup {
  uf?: unknown;
  sum?: unknown;
  mean?: unknown;
}

/**
 * As chaves territoriais agregadas (`2_regiao-…`, `3_bioma-…`) não existem
 * nesta forma de tabela: ela só traz linhas municipais, e recortes como bioma ou
 * ASD dependeriam de um cruzamento espacial que o asset não carrega. Estado e
 * Brasil, esses sim, saem da agregação das linhas municipais.
 */
function isSupportedLocationKey(locationKey: string) {
  return (
    locationKey === "br" ||
    MUNICIPALITY_KEY_PATTERN.test(locationKey) ||
    /^[a-z]{2}$/u.test(locationKey)
  );
}

/**
 * Agrupa os períodos pedidos pelo asset que os guarda.
 *
 * Um período incompatível com a granularidade da fonte é descartado aqui em vez
 * de derrubar a leitura: ele falha sozinho quando o painel o pede.
 */
export function planValueTableReads(
  source: GeeMunicipalValueTableStatisticsSource,
  periodKeys: readonly string[],
): ValueTableReadPlan[] {
  const plansByAsset = new Map<string, ValueTableReadPlan>();

  for (const periodKey of [...new Set(periodKeys)].sort()) {
    let resolved;
    try {
      resolved = resolveGeeMunicipalValueTableSource(source, periodKey);
    } catch {
      continue;
    }

    const plan = plansByAsset.get(resolved.assetId) ?? {
      assetId: resolved.assetId,
      periodKeys: [],
      valueColumns: [],
    };
    plan.periodKeys.push(periodKey);
    plan.valueColumns.push(resolved.valueColumn);
    plansByAsset.set(resolved.assetId, plan);
  }

  return [...plansByAsset.values()];
}

function buildAggregateExpression(
  source: GeeMunicipalValueTableStatisticsSource,
  plan: ValueTableReadPlan,
) {
  const collection = ee.FeatureCollection(plan.assetId);
  const reducer =
    source.aggregation === "sum" ? ee.Reducer.sum() : ee.Reducer.mean();
  const repeated = reducer.repeat(plan.valueColumns.length);

  // Um `reduceColumns` agrupado devolve as 27 UFs, e não as 5.573 linhas
  // municipais: é o que faz o recorte nacional caber num pedido de menos de um
  // segundo em vez de transferir a tabela inteira para o Node.
  return ee.Dictionary({
    total: collection
      .reduceColumns(repeated, plan.valueColumns)
      .get(source.aggregation),
    byState: collection
      .reduceColumns(repeated.group(plan.valueColumns.length, "uf"), [
        ...plan.valueColumns,
        source.properties.stateCode,
      ])
      .get("groups"),
  });
}

function buildMunicipalityExpression(
  source: GeeMunicipalValueTableStatisticsSource,
  plan: ValueTableReadPlan,
  municipalityCode: string,
) {
  const properties = [
    ...plan.valueColumns,
    ...getGeeMunicipalValueTableProperties(source),
  ];
  const filtered = ee
    .FeatureCollection(plan.assetId)
    .filter(ee.Filter.eq(source.properties.municipalityCode, municipalityCode));

  // `first()` de uma coleção vazia é nulo, e `toDictionary` sobre ele quebra o
  // pedido inteiro. Um município ausente da tabela é um dado que falta, não um
  // erro de configuração: ele volta como dicionário vazio e vira "sem dado".
  return ee.Dictionary(
    ee.Algorithms.If(
      filtered.size().gt(0),
      ee.Feature(filtered.first()).toDictionary(properties),
      ee.Dictionary({}),
    ),
  );
}

function readAggregateRows(
  source: GeeMunicipalValueTableStatisticsSource,
  plans: ValueTableReadPlan[],
  results: Record<string, { total?: unknown; byState?: unknown }>,
): MunicipalValueRow[] {
  const brazilValues: Record<string, number | null> = {};
  const valuesByState = new Map<unknown, Record<string, number | null>>();

  for (const plan of plans) {
    const result = results[plan.assetId] ?? {};
    Object.assign(
      brazilValues,
      toValuesByPeriod(plan.periodKeys, result.total),
    );

    for (const group of (result.byState ?? []) as StateGroup[]) {
      const values = valuesByState.get(group.uf) ?? {};
      Object.assign(
        values,
        toValuesByPeriod(plan.periodKeys, group[source.aggregation]),
      );
      valuesByState.set(group.uf, values);
    }
  }

  const stateRows = [...valuesByState.entries()].flatMap(([uf, values]) => {
    const row = buildStateRow(uf, values);
    return row ? [row] : [];
  });

  return [
    { locationKey: "br", label: "Brasil", valuesByPeriod: brazilValues },
    ...stateRows,
  ];
}

function readMunicipalityRows(
  source: GeeMunicipalValueTableStatisticsSource,
  plans: ValueTableReadPlan[],
  results: Record<string, Record<string, unknown>>,
): MunicipalValueRow[] {
  const valuesByPeriod: Record<string, number | null> = {};
  let properties: Record<string, unknown> | null = null;

  for (const plan of plans) {
    const assetProperties = results[plan.assetId] ?? {};
    if (Object.keys(assetProperties).length === 0) continue;

    properties = properties ?? assetProperties;
    Object.assign(
      valuesByPeriod,
      toSingleValuesByPeriod(
        plan.periodKeys,
        assetProperties,
        Object.fromEntries(
          plan.periodKeys.map((periodKey, position) => [
            periodKey,
            plan.valueColumns[position],
          ]),
        ),
      ),
    );
  }

  return properties
    ? [buildMunicipalityRow(source, properties, valuesByPeriod)]
    : [];
}

/**
 * Uma ida ao Earth Engine para todos os assets e todos os períodos.
 *
 * O custo de uma leitura é o do round trip, não o do volume, então pedir a série
 * inteira de uma vez é o que faz trocar de período no painel não custar nada.
 */
async function readValueTableRows(
  source: GeeMunicipalValueTableStatisticsSource,
  plans: ValueTableReadPlan[],
  locationKey: string,
): Promise<MunicipalValueRow[]> {
  const isMunicipality = MUNICIPALITY_KEY_PATTERN.test(locationKey);
  const request = ee.Dictionary(
    Object.fromEntries(
      plans.map((plan) => [
        plan.assetId,
        isMunicipality
          ? buildMunicipalityExpression(source, plan, locationKey)
          : buildAggregateExpression(source, plan),
      ]),
    ),
  );
  const results =
    await evaluateGeeObject<Record<string, Record<string, unknown>>>(request);

  if (!results || typeof results !== "object") {
    throw new Error(
      `Resposta inválida da tabela municipal GEE ${plans.map((plan) => plan.assetId).join(", ")}.`,
    );
  }

  return isMunicipality
    ? readMunicipalityRows(source, plans, results)
    : readAggregateRows(source, plans, results);
}

function toCachedRows(rows: MunicipalValueRow[]): Record<string, unknown>[] {
  return rows as unknown as Record<string, unknown>[];
}

function fromCachedRows(rows: Record<string, unknown>[]): MunicipalValueRow[] {
  return rows as unknown as MunicipalValueRow[];
}

/**
 * O patch territorial de um período lido de uma tabela municipal de valor único.
 *
 * `periodKeys` são todos os períodos publicados da camada: a leitura cobre a
 * série inteira e os demais períodos saem do cache, então abrir a camada custa
 * uma ida ao Earth Engine em vez de uma por período.
 *
 * @example
 * await getMunicipalValueTableYearPatch(source, "2024", "2507507", ["2023", "2024"]);
 */
export async function getMunicipalValueTableYearPatch(
  source: GeeMunicipalValueTableStatisticsSource,
  yearKey: string,
  locationKey: string,
  periodKeys: readonly string[] = [],
): Promise<MunicipalValueTableYearResult> {
  const plans = planValueTableReads(
    source,
    periodKeys.length > 0 ? [...periodKeys, yearKey] : [yearKey],
  );
  if (plans.length === 0) {
    throw new Error(
      `Período ${yearKey} incompatível com a tabela municipal de ${source.periodGranularity === "month" ? "meses" : "anos"}.`,
    );
  }

  const assetIds = plans.map((plan) => plan.assetId);
  if (!isSupportedLocationKey(locationKey)) {
    return {
      assetIds,
      patch: {
        locations: {},
        years: { [yearKey]: { valuesScale: 1, values: {} } },
      },
    };
  }

  // O recorte agregado (Brasil e as 27 UFs) é uma leitura só: guardá-la sob uma
  // chave comum faz o usuário que troca de UF reaproveitar o que já foi lido
  // para o Brasil, em vez de pagar uma ida por estado.
  const cacheLocation = MUNICIPALITY_KEY_PATTERN.test(locationKey)
    ? locationKey
    : "aggregates";
  const rows = await getOrLoadStatisticsRows(
    buildStatisticsRowsCacheKey(assetIds, cacheLocation, [
      source.aggregation,
      ...plans.flatMap((plan) => plan.valueColumns),
      ...getGeeMunicipalValueTableProperties(source),
    ]),
    async () =>
      toCachedRows(await readValueTableRows(source, plans, locationKey)),
  );

  return {
    assetIds,
    patch: mapMunicipalValueRows(fromCachedRows(rows), yearKey, locationKey),
  };
}
