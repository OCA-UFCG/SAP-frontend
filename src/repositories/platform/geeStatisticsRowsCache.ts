import "server-only";

import { createHash } from "node:crypto";

// As tabelas estatísticas mudam numa cadência de semanas, e uma tabela trocada
// no Earth Engine é percebida pela checagem de `updateTime`
// (`geeStatisticsAssetRevisions`), que descarta só as entradas daquela tabela.
// O prazo é a rede de segurança para o que a checagem não vê. Com 10 min, três
// em cada quatro aberturas do Detalhamento na produção achavam o cache vazio
// (telemetria de set–out/2026) e esperavam 2–4 s pelo Earth Engine.
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
// Uma entrada é o recorte de um território dentro de uma série de assets:
// ~1260 linhas para `br` no índice de aridez do ERA5-Land (Brasil + 27 estados
// x 45 anos, ~390 KiB) e 45 para um município. O teto existe para uma navegação
// longa por municípios não fazer o mapa crescer sem fim.
//
// Medido em relatórios reais: ~5 KB por município e ~110 KB por estado ou
// Brasil. Só ~45 recortes são grandes, então 5.000 entradas ficam em ~150 MB no
// pior caso e bem menos no uso normal, que é de municípios.
const DEFAULT_MAX_ENTRIES = 5000;

/**
 * Um teto próprio para um tipo de entrada muito maior que as outras.
 *
 * Os municípios do Brasil num período ("Territórios por classificação") são
 * 5.573 linhas, ~1,1 MB por entrada: sob o teto geral, pensado para entradas de
 * 5 a 110 KB, eles poderiam passar de 5 GB. O grupo limita só essas entradas e
 * descarta a menos usada delas, sem tirar do cache as entradas pequenas.
 */
export interface StatisticsRowsGroupLimit {
  group: string;
  maxEntries: number;
}

/** 100 períodos de camadas diferentes, ~115 MB no pior caso. */
export const MUNICIPALITIES_BY_PERIOD_LIMIT: StatisticsRowsGroupLimit = {
  group: "municipios-do-periodo",
  maxEntries: 100,
};

interface StatisticsRowsEntry {
  rows: Record<string, unknown>[];
  timestamp: number;
  /** Os assets lidos, para descartar a entrada quando um deles mudar. */
  assetIds: readonly string[];
  group?: string;
}

interface PendingStatisticsRows {
  request: Promise<Record<string, unknown>[]>;
  assetIds: readonly string[];
}

interface StatisticsRowsCacheState {
  rows: Map<string, StatisticsRowsEntry>;
  pending: Map<string, PendingStatisticsRows>;
  generation: number;
}

// No `globalThis` pelo mesmo motivo das colunas e das URLs do Earth Engine: o
// aquecimento da subida (`instrumentation`) e as rotas recebem cópias separadas
// deste módulo, e numa variável do módulo o que a subida lia não chegava à rota.
const sharedState = globalThis as typeof globalThis & {
  __geeStatisticsRowsCache?: StatisticsRowsCacheState;
};
const state: StatisticsRowsCacheState =
  (sharedState.__geeStatisticsRowsCache ??= {
    rows: new Map(),
    pending: new Map(),
    generation: 0,
  });

const rowsByAssetLocation = state.rows;
// Uma promessa por chave em voo. É o ponto principal deste cache: ao abrir uma
// camada, o painel dispara um pedido HTTP por período ao mesmo tempo, e sem o
// dedupe os 45 pedidos viram 45 leituras simultâneas no Earth Engine.
const pendingRowsByAssetLocation = state.pending;

function getMaxEntries() {
  const value = Number(process.env.GEE_STATISTICS_ROWS_CACHE_MAX_ENTRIES);

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_MAX_ENTRIES;
  }

  return Math.floor(value);
}

/**
 * Chave de uma leitura: os assets cobertos, o território e o conjunto de
 * propriedades pedidas.
 *
 * Os assets entram resumidos porque uma série `period-template` de 45 anos tem
 * 45 ids longos: o primeiro fica legível para inspeção e o digest garante que
 * duas coberturas diferentes nunca compartilhem a mesma entrada — sem ele, uma
 * leitura de um período só serviria de resposta para a série inteira. As
 * propriedades entram porque duas camadas podem apontar para o mesmo asset
 * pedindo métricas escalares diferentes.
 *
 * @example
 * buildStatisticsRowsCacheKey(["projects/x/t_2020"], "br", ["ano"]);
 */
export function buildStatisticsRowsCacheKey(
  assetIds: readonly string[],
  locationKey: string,
  requestedProperties: readonly string[],
) {
  const digest = createHash("sha1")
    .update(assetIds.join("\n"))
    .digest("hex")
    .slice(0, 12);

  return `${assetIds[0] ?? ""}+${assetIds.length}#${digest}::${locationKey}::${requestedProperties.join(",")}`;
}

// Map preserva ordem de inserção: reinserir a chave lida deixa a menos
// recentemente usada em primeiro lugar, o que torna a evicção O(1).
function markAsRecentlyUsed(key: string, entry: StatisticsRowsEntry) {
  rowsByAssetLocation.delete(key);
  rowsByAssetLocation.set(key, entry);
}

function evictLeastRecentlyUsed() {
  const maxEntries = getMaxEntries();

  while (rowsByAssetLocation.size > maxEntries) {
    const { value: oldestKey } = rowsByAssetLocation.keys().next();

    if (oldestKey === undefined) {
      return;
    }

    rowsByAssetLocation.delete(oldestKey);
  }
}

function evictLeastRecentlyUsedOfGroup({
  group,
  maxEntries,
}: StatisticsRowsGroupLimit) {
  const groupKeys = [...rowsByAssetLocation]
    .filter(([, entry]) => entry.group === group)
    .map(([key]) => key);

  for (const key of groupKeys.slice(
    0,
    Math.max(0, groupKeys.length - maxEntries),
  )) {
    rowsByAssetLocation.delete(key);
  }
}

function startLoad(
  key: string,
  loadRows: () => Promise<Record<string, unknown>[]>,
  assetIds: readonly string[],
  limit?: StatisticsRowsGroupLimit,
): Promise<Record<string, unknown>[]> {
  const pending = pendingRowsByAssetLocation.get(key);
  if (pending) {
    return pending.request;
  }

  const request = loadRows()
    .then((rows) => {
      // Uma invalidação no meio da leitura apagou a promessa: o resultado pode
      // ser da tabela antiga, então serve a quem pediu mas não fica guardado.
      if (pendingRowsByAssetLocation.get(key)?.request === request) {
        markAsRecentlyUsed(key, {
          rows,
          timestamp: Date.now(),
          assetIds,
          group: limit?.group,
        });
        evictLeastRecentlyUsed();
        if (limit) evictLeastRecentlyUsedOfGroup(limit);
      }
      return rows;
    })
    .finally(() => {
      if (pendingRowsByAssetLocation.get(key)?.request === request) {
        pendingRowsByAssetLocation.delete(key);
      }
    });

  pendingRowsByAssetLocation.set(key, { request, assetIds });
  return request;
}

/**
 * Linhas de um asset estatístico para um território, lidas uma única vez por
 * chave mesmo quando vários períodos são pedidos ao mesmo tempo.
 *
 * Passado o prazo, a entrada vencida ainda responde na hora e a releitura corre
 * em segundo plano: quem abre o painel não espera o Earth Engine por causa de
 * um prazo, só quando a tabela de fato mudou.
 *
 * `limit` dá a um tipo de entrada grande um teto próprio, além do geral.
 *
 * const rows = await getOrLoadStatisticsRows(key, () => readFromEarthEngine(), assetIds);
 */
export function getOrLoadStatisticsRows(
  key: string,
  loadRows: () => Promise<Record<string, unknown>[]>,
  assetIds: readonly string[] = [],
  limit?: StatisticsRowsGroupLimit,
): Promise<Record<string, unknown>[]> {
  const entry = rowsByAssetLocation.get(key);

  if (entry) {
    markAsRecentlyUsed(key, entry);

    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      startLoad(key, loadRows, assetIds, limit).catch((error: unknown) => {
        console.warn(
          `[geeStatistics] releitura em segundo plano falhou; a entrada vencida continua servindo: ${key}`,
          error,
        );
      });
    }

    return Promise.resolve(entry.rows);
  }

  return startLoad(key, loadRows, assetIds, limit);
}

/**
 * Os assets lidos pelas entradas guardadas e o momento da leitura mais antiga
 * de cada um — o que a checagem de `updateTime` precisa comparar.
 */
export function getCachedStatisticsAssetReadTimes(): Map<string, number> {
  const readTimes = new Map<string, number>();

  for (const entry of rowsByAssetLocation.values()) {
    for (const assetId of entry.assetIds) {
      const current = readTimes.get(assetId);
      if (current === undefined || entry.timestamp < current) {
        readTimes.set(assetId, entry.timestamp);
      }
    }
  }

  return readTimes;
}

/**
 * Descarta as entradas que leram algum asset para o qual `isStale` responde
 * `true`, e as leituras em voo desses mesmos assets. Devolve quantas entradas
 * saíram.
 *
 * @example
 * invalidateStatisticsRows((assetId, readAt) => updatedAt(assetId) > readAt);
 */
export function invalidateStatisticsRows(
  isStale: (assetId: string, readAt: number) => boolean,
): number {
  let removed = 0;

  for (const [key, entry] of rowsByAssetLocation) {
    if (entry.assetIds.some((assetId) => isStale(assetId, entry.timestamp))) {
      rowsByAssetLocation.delete(key);
      pendingRowsByAssetLocation.delete(key);
      removed += 1;
    }
  }

  // Uma leitura em voo começou agora e pode ter visto a tabela antiga.
  const now = Date.now();
  for (const [key, pending] of pendingRowsByAssetLocation) {
    if (pending.assetIds.some((assetId) => isStale(assetId, now))) {
      pendingRowsByAssetLocation.delete(key);
      removed += 1;
    }
  }

  if (removed > 0) state.generation += 1;
  return removed;
}

/**
 * Um número que muda sempre que linhas guardadas são descartadas. Os caches
 * montados em cima destas linhas (o Detalhamento já pronto de cada período)
 * comparam com ele para não servir a versão montada com a tabela antiga.
 */
export function getStatisticsRowsGeneration(): number {
  return state.generation;
}

export function clearGeeStatisticsRowsCache() {
  rowsByAssetLocation.clear();
  pendingRowsByAssetLocation.clear();
  state.generation += 1;
}

export { CACHE_TTL_MS as GEE_STATISTICS_ROWS_CACHE_TTL_MS };
