import "server-only";

import ee from "@google/earthengine";
import type {
  GeeStatisticsSchema,
  ResolvedGeeStatisticsSource,
} from "@/contracts/geeStatistics";
import { evaluateGeeObject } from "@/infrastructure/earth-engine/client";
import { chunk } from "@/utils/chunk";

/**
 * Tudo que a validação de uma tabela estatística precisa saber do Earth Engine,
 * numa única leitura. Antes eram oito `evaluate` independentes sobre a mesma
 * FeatureCollection; o Earth Engine responde as oito perguntas de uma vez
 * dentro de um `ee.Dictionary`, então a validação de uma tabela custa 1 ida e
 * volta em vez de 8.
 */
export interface StatisticsAssetProbe {
  periods: unknown[];
  /**
   * Pares período/sigla de trimestre, presentes só quando o asset tem a coluna
   * `temporada`. É o que distingue uma previsão trimestral (a sigla acompanha o
   * período: `2026-09` → `SON`) de uma previsão mensal cujo asset carrega a
   * sigla da emissão, igual em todos os meses (`2026-10`, `2026-11` → `OND`).
   */
  seasonPairs?: unknown;
  rowCount: number;
  completeCount: number;
  distinctCount: number;
  municipalCount: number;
  completeMunicipalCount: number;
  stateCount: number;
  completeStateCount: number;
  /**
   * Linhas cujos percentuais saem de 0–100 ou não somam
   * `100 ± PERCENTAGE_TOLERANCE`. Uma linha toda zerada é ausência de dado e
   * conta como válida.
   */
  invalidPercentageCount: number;
}

/** Folga aceita na soma dos percentuais de uma linha. */
export const PERCENTAGE_TOLERANCE = 0.2;

export interface StatisticsAssetProbeRequest {
  source: ResolvedGeeStatisticsSource;
  schema: GeeStatisticsSchema;
}

// Quantas tabelas entram em cada pedido. Medido no índice de 35 anos: um pedido
// único com as 35 tabelas responde em ~12 s, e um com 70 entradas responde no
// mesmo tempo — o Earth Engine trata o conjunto como uma computação só. O lote
// é menor que isso de propósito: um asset inexistente derruba o pedido inteiro
// (com o nome dele no erro), e um lote menor invalida menos trabalho.
const PROBE_BATCH_SIZE = 10;

// Quantos lotes correm ao mesmo tempo. Cada lote ocupa uma das 20 vagas de
// leitura simultânea que o processo inteiro divide (`GEE_COMPUTE_CONCURRENCY`),
// então o valor fica baixo para a sondagem do catálogo não tomar as vagas do
// mapa e do relatório; ele existe para um índice com muitos anos não virar uma
// fila longa de lotes sequenciais.
const PROBE_BATCH_CONCURRENCY = 3;

function requiredProperties(
  source: ResolvedGeeStatisticsSource,
  schema: GeeStatisticsSchema,
) {
  return [
    source.properties.level,
    source.properties.locationName,
    source.properties.year,
    source.properties.date,
    source.properties.totalArea,
    ...schema.percentageProperties,
    ...schema.classAreaProperties,
  ];
}

function periodProperty(source: ResolvedGeeStatisticsSource) {
  return source.periodGranularity === "month"
    ? source.properties.date
    : source.properties.year;
}

/**
 * Conta, dentro do Earth Engine, as linhas com percentuais inválidos.
 *
 * As colunas viram uma matriz (uma linha por classe, uma coluna por linha da
 * tabela) e a conta inteira acontece sobre ela, devolvendo só um número. Antes
 * as colunas desciam cruas para a conferência rodar no Node: numa tabela
 * decendial (202 mil linhas por ano) isso dava ~70 MB por lote de 10 tabelas,
 * e o download estourava o prazo de 30 s de cada pedido. Com a matriz o lote
 * de 10 responde em ~13 s. Um `map()` por linha, a outra forma de fazer a conta
 * no Earth Engine, custava ~38 s numa tabela de 67 mil linhas.
 *
 * As linhas com algum percentual nulo ficam de fora (a matriz exige todas as
 * colunas do mesmo tamanho); quem acusa essas linhas é o `completeCount`.
 */
function invalidPercentageRowCount(
  collection: ReturnType<typeof ee.FeatureCollection>,
  percentageProperties: string[],
) {
  const columns = ee.Array(
    collection
      .reduceColumns(
        ee.Reducer.toList().repeat(percentageProperties.length),
        percentageProperties,
      )
      .get("list"),
  );
  const outOfRange = columns
    .lt(0)
    .or(columns.gt(100))
    .reduce(ee.Reducer.max(), [0]);
  const allZero = columns.neq(0).reduce(ee.Reducer.max(), [0]).not();
  const wrongTotal = columns
    .reduce(ee.Reducer.sum(), [0])
    .subtract(100)
    .abs()
    .gt(PERCENTAGE_TOLERANCE)
    .and(allZero.not());
  return ee.Number(
    outOfRange.or(wrongTotal).reduce(ee.Reducer.sum(), [0, 1]).get([0, 0]),
  );
}

function buildProbeExpression({ source, schema }: StatisticsAssetProbeRequest) {
  const collection = ee.FeatureCollection(source.assetId);
  const municipalRows = collection.filter(
    ee.Filter.eq(source.properties.level, "7_Municipio"),
  );
  const stateRows = collection.filter(
    ee.Filter.eq(source.properties.level, "6_Estado"),
  );

  const seasonProperty = schema.seasonProperty;

  return ee.Dictionary({
    periods: collection.aggregate_array(periodProperty(source)).distinct(),
    ...(seasonProperty
      ? {
          seasonPairs: collection
            .distinct([periodProperty(source), seasonProperty])
            .reduceColumns(ee.Reducer.toList().repeat(2), [
              periodProperty(source),
              seasonProperty,
            ])
            .get("list"),
        }
      : {}),
    rowCount: collection.size(),
    completeCount: collection
      .filter(ee.Filter.notNull(requiredProperties(source, schema)))
      .size(),
    distinctCount: collection
      .distinct([
        source.properties.level,
        source.properties.locationName,
        source.properties.municipalityCode,
        source.properties.stateCode,
        source.properties.year,
        source.properties.date,
      ])
      .size(),
    municipalCount: municipalRows.size(),
    completeMunicipalCount: municipalRows
      .filter(
        ee.Filter.notNull([
          source.properties.municipalityCode,
          source.properties.stateCode,
        ]),
      )
      .size(),
    stateCount: stateRows.size(),
    completeStateCount: stateRows
      .filter(ee.Filter.notNull([source.properties.stateCode]))
      .size(),
    invalidPercentageCount: invalidPercentageRowCount(
      collection.filter(ee.Filter.notNull(schema.percentageProperties)),
      schema.percentageProperties,
    ),
  });
}

async function readProbeBatch(requests: StatisticsAssetProbeRequest[]) {
  const probes = await evaluateGeeObject<StatisticsAssetProbe[]>(
    ee.List(requests.map(buildProbeExpression)),
  );
  return requests.map((request, index) => {
    const probe = probes?.[index];
    if (!probe) {
      throw new Error(
        `O Earth Engine não devolveu a leitura de ${request.source.assetId}: esperado um resultado por tabela em um lote de ${requests.length}.`,
      );
    }
    return [request.source.assetId, probe] as const;
  });
}

/**
 * Lê em lote as propriedades da primeira feature de cada tabela — é daí que sai
 * o schema de classes. As 35 tabelas de um índice anual respondem em ~7 s num
 * pedido só, contra ~53 s quando cada uma era um `evaluate` separado.
 *
 * @example
 * const properties = await readStatisticsAssetProperties(["projects/x/assets/t_2024"]);
 * // [["NIVEL_AGRUPAMENTO", "perc_classe_1", ...]]
 */
export async function readStatisticsAssetProperties(
  assetIds: string[],
): Promise<string[][]> {
  if (assetIds.length === 0) return [];

  const properties = await evaluateGeeObject<string[][]>(
    ee.List(
      assetIds.map((assetId) =>
        ee.Feature(ee.FeatureCollection(assetId).first()).propertyNames(),
      ),
    ),
  );

  return assetIds.map((assetId, index) => {
    const names = properties?.[index];
    if (!Array.isArray(names)) {
      throw new Error(
        `O Earth Engine não devolveu as colunas de ${assetId}: esperado um resultado por tabela em um lote de ${assetIds.length}.`,
      );
    }
    return names.filter((name) => !name.startsWith("system:"));
  });
}

/**
 * Lê em lote as contagens e a conferência de percentuais das tabelas pedidas.
 * Devolve um mapa por `assetId` para o chamador conferir cada tabela em Node.
 *
 * @example
 * const probes = await readStatisticsAssetProbes([{ source, schema }]);
 * probes.get(source.assetId)?.rowCount; // 5615
 */
export async function readStatisticsAssetProbes(
  requests: StatisticsAssetProbeRequest[],
): Promise<Map<string, StatisticsAssetProbe>> {
  const probes = new Map<string, StatisticsAssetProbe>();
  if (requests.length === 0) return probes;

  const batches = chunk(requests, PROBE_BATCH_SIZE);
  for (const wave of chunk(batches, PROBE_BATCH_CONCURRENCY)) {
    const results = await Promise.all(wave.map(readProbeBatch));
    for (const batch of results) {
      for (const [assetId, probe] of batch) probes.set(assetId, probe);
    }
  }
  return probes;
}
