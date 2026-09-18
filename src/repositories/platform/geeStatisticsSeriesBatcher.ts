import "server-only";

import { chunk } from "@/utils/chunk";

/**
 * Quantos assets entram numa ida ao Earth Engine.
 *
 * Medido no índice de aridez do ERA5-Land (45 anos, território `br`): um pedido
 * com os 45 assets responde em 4243 ms e três pedidos de 15 respondem em
 * 2968 ms. O teto também limita o estrago de uma falha: um asset inexistente
 * derruba o pedido inteiro, e só então há releitura asset a asset — subir o
 * bloco encareceria justamente o dia em que uma tabela está sendo reingerida.
 *
 * O ganho do relatório municipal não vem de blocos maiores, vem de os blocos
 * serem preenchidos com assets de camadas diferentes: o SDK do Earth Engine
 * despacha uma requisição a cada 350 ms de uma fila global do processo, então
 * 16 camadas pedindo ~167 assets pagam no número de idas, não no tamanho delas.
 */
export const SERIES_ASSETS_PER_REQUEST = 15;

/**
 * A janela em que pedidos de camadas diferentes esperam uns pelos outros antes
 * de virar uma ida só. É curta de propósito: o relatório dispara as leituras
 * das suas camadas no mesmo tique, e um pedido isolado (o painel abrindo uma
 * camada) não deve pagar mais do que isso de espera.
 */
export const SERIES_BATCH_WINDOW_MS = 20;

/** A coluna sintética que diz de qual pedido a linha veio. */
const OWNER_PROPERTY = "__pedido";

export interface StatisticsAssetRead {
  assetId: string;
  /**
   * A sub-coleção do asset, já filtrada pelo território e reduzida às
   * propriedades pedidas, marcada com `ownerTag` para que a resposta conjunta
   * possa ser separada de volta por pedido.
   */
  buildCollection: (ownerTag: number) => unknown;
}

export interface StatisticsSeriesReading {
  rows: Record<string, unknown>[];
  unavailableAssetIds: string[];
  firstError?: unknown;
}

/** Avalia um conjunto de sub-coleções numa única ida ao Earth Engine. */
export type MergedCollectionsEvaluator = (
  collections: readonly unknown[],
  assetIds: readonly string[],
) => Promise<Record<string, unknown>[]>;

interface QueuedRead {
  ownerTag: number;
  assetId: string;
  collection: unknown;
}

interface QueuedOwner {
  ownerTag: number;
  assetIds: string[];
  resolve: (reading: StatisticsSeriesReading) => void;
}

let queuedReads: QueuedRead[] = [];
let queuedOwners: QueuedOwner[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let nextOwnerTag = 0;
let evaluateMergedCollections: MergedCollectionsEvaluator | null = null;

/**
 * Registra como as sub-coleções enfileiradas viram uma resposta.
 *
 * Existe para o repositório manter o Earth Engine só do lado dele e para o
 * teste deste módulo poder injetar um avaliador falso.
 */
export function setMergedCollectionsEvaluator(
  evaluator: MergedCollectionsEvaluator,
) {
  evaluateMergedCollections = evaluator;
}

function takeOwnerTag() {
  nextOwnerTag += 1;
  return nextOwnerTag;
}

/**
 * As linhas de uma série estatística, lidas junto com as séries que outras
 * camadas pediram na mesma janela.
 *
 * Cada camada do relatório municipal era uma ida própria ao Earth Engine, e as
 * idas não se sobrepõem: o SDK espaça o despacho em 350 ms. Juntar os assets de
 * todas elas troca ~23 idas por ~4 no relatório completo.
 *
 * @example
 * const { rows } = await readStatisticsSeries([
 *   { assetId: "projects/x/aridez_2024", buildCollection: (tag) => collection(tag) },
 * ]);
 */
export function readStatisticsSeries(
  reads: readonly StatisticsAssetRead[],
): Promise<StatisticsSeriesReading> {
  if (reads.length === 0) {
    return Promise.resolve({ rows: [], unavailableAssetIds: [] });
  }

  const ownerTag = takeOwnerTag();

  return new Promise<StatisticsSeriesReading>((resolve) => {
    queuedOwners.push({
      ownerTag,
      assetIds: reads.map(({ assetId }) => assetId),
      resolve,
    });
    for (const read of reads) {
      queuedReads.push({
        ownerTag,
        assetId: read.assetId,
        collection: read.buildCollection(ownerTag),
      });
    }
    scheduleFlush();
  });
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushQueuedReads();
  }, SERIES_BATCH_WINDOW_MS);
}

async function flushQueuedReads() {
  const reads = queuedReads;
  const owners = queuedOwners;
  queuedReads = [];
  queuedOwners = [];

  const readings = await Promise.all(
    chunk(reads, SERIES_ASSETS_PER_REQUEST).map(readGroupIsolatingFailures),
  );
  const merged = readings.flat();

  for (const owner of owners) {
    owner.resolve(collectOwnerReading(owner, merged));
  }
}

interface GroupReading {
  ownerTag: number;
  /** Os assets deste dono dentro do grupo lido. */
  assetIds: string[];
  /** `null` quando a leitura falhou: são esses assets que ficam de fora. */
  rows: Record<string, unknown>[] | null;
  error?: unknown;
}

/**
 * Lê um grupo numa ida só e, se ela falhar, relê asset por asset.
 *
 * `ee.FeatureCollection([...]).flatten()` é tudo ou nada: um asset ilegível
 * derruba o pedido do grupo inteiro e leva junto os anos — e agora também as
 * camadas — que estavam no ar. Foi o que tirou o Monitor de Secas da ANA do
 * painel e do relatório enquanto a tabela de 2026 estava sendo reingerida. A
 * releitura custa uma ida por asset e só acontece no caminho de erro.
 */
async function readGroupIsolatingFailures(
  group: readonly QueuedRead[],
): Promise<GroupReading[]> {
  try {
    const rows = await evaluateGroup(group);
    return splitRowsByOwner(group, rows);
  } catch {
    return Promise.all(group.map(readSingleAsset));
  }
}

async function readSingleAsset(read: QueuedRead): Promise<GroupReading> {
  try {
    const rows = await evaluateGroup([read]);
    return {
      ownerTag: read.ownerTag,
      assetIds: [read.assetId],
      rows: stripOwnerTags(rows),
    };
  } catch (error) {
    console.error(
      `[geeStatistics] asset indisponível, fora da série: ${read.assetId}`,
      error,
    );
    return {
      ownerTag: read.ownerTag,
      assetIds: [read.assetId],
      rows: null,
      error,
    };
  }
}

function evaluateGroup(group: readonly QueuedRead[]) {
  if (!evaluateMergedCollections) {
    return Promise.reject(
      new Error(
        "Nenhum avaliador de coleções registrado para a leitura em lote do Earth Engine.",
      ),
    );
  }

  return evaluateMergedCollections(
    group.map(({ collection }) => collection),
    group.map(({ assetId }) => assetId),
  );
}

function stripOwnerTag(row: Record<string, unknown>) {
  if (!(OWNER_PROPERTY in row)) return row;
  const rest = { ...row };
  delete rest[OWNER_PROPERTY];
  return rest;
}

function stripOwnerTags(rows: readonly Record<string, unknown>[]) {
  return rows.map(stripOwnerTag);
}

/**
 * Devolve cada linha ao pedido que a encomendou e tira a coluna sintética.
 *
 * Um grupo de um dono só dispensa a marcação: é o caso do painel abrindo uma
 * camada, e é também o do caminho de releitura asset a asset. Quando há mais de
 * um dono e uma linha chega sem marcação reconhecível, a leitura conjunta falha
 * de propósito — o grupo é relido asset a asset. Entregar a linha ao dono
 * errado misturaria os dados de duas camadas, e isso não apareceria como erro
 * nenhum: apareceria como número errado no relatório.
 */
function splitRowsByOwner(
  group: readonly QueuedRead[],
  rows: readonly Record<string, unknown>[],
): GroupReading[] {
  const assetIdsByOwner = new Map<number, string[]>();
  for (const { ownerTag, assetId } of group) {
    const assetIds = assetIdsByOwner.get(ownerTag);
    if (assetIds) assetIds.push(assetId);
    else assetIdsByOwner.set(ownerTag, [assetId]);
  }

  if (assetIdsByOwner.size === 1) {
    const [[ownerTag, assetIds]] = [...assetIdsByOwner];
    return [{ ownerTag, assetIds, rows: stripOwnerTags(rows) }];
  }

  const rowsByOwner = new Map<number, Record<string, unknown>[]>();
  for (const ownerTag of assetIdsByOwner.keys()) rowsByOwner.set(ownerTag, []);
  for (const row of rows) {
    const ownerRows = rowsByOwner.get(Number(row[OWNER_PROPERTY]));
    if (!ownerRows) {
      throw new Error(
        `Linha do Earth Engine sem a marcação ${OWNER_PROPERTY} numa leitura de ${assetIdsByOwner.size} séries; esperado o número do pedido.`,
      );
    }
    ownerRows.push(stripOwnerTag(row));
  }

  return [...assetIdsByOwner].map(([ownerTag, assetIds]) => ({
    ownerTag,
    assetIds,
    rows: rowsByOwner.get(ownerTag) ?? [],
  }));
}

function collectOwnerReading(
  owner: QueuedOwner,
  readings: readonly GroupReading[],
): StatisticsSeriesReading {
  const ownerReadings = readings.filter(
    ({ ownerTag }) => ownerTag === owner.ownerTag,
  );

  return {
    rows: ownerReadings.flatMap(({ rows }) => rows ?? []),
    unavailableAssetIds: ownerReadings
      .filter(({ rows }) => rows === null)
      .flatMap(({ assetIds }) => assetIds),
    firstError: ownerReadings.find(({ error }) => error)?.error,
  };
}

/** A coluna sintética, para o repositório marcar as sub-coleções. */
export { OWNER_PROPERTY as STATISTICS_OWNER_PROPERTY };
