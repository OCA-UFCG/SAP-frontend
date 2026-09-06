import "server-only";

import { createHash } from "node:crypto";

const CACHE_TTL_MS = 1000 * 60 * 10;
// Uma entrada é o recorte de um território dentro de uma série de assets:
// ~1260 linhas para `br` no índice de aridez do ERA5-Land (Brasil + 27 estados
// x 45 anos, ~390 KiB) e ~10.000 para uma UF, desde que a leitura municipal
// passou a trazer o estado inteiro. O teto existe para uma navegação longa por
// municípios não fazer o mapa crescer sem fim.
const DEFAULT_MAX_ENTRIES = 200;
// Só contar entradas deixou de descrever a memória usada quando elas passaram a
// diferir em duas ordens de grandeza: 200 entradas de UF seriam ~400 MB. O teto
// de linhas mantém o gasto na mesma faixa de antes (~250 mil linhas, ~60 MB) e
// cabe cerca de 25 UFs de uma camada, ou uma UF de cada uma das camadas do
// relatório.
const DEFAULT_MAX_ROWS = 250_000;

interface StatisticsRowsEntry {
  rows: Record<string, unknown>[];
  timestamp: number;
}

let cachedRowCount = 0;

const rowsByAssetLocation = new Map<string, StatisticsRowsEntry>();
// Uma promessa por chave em voo. É o ponto principal deste cache: ao abrir uma
// camada, o painel dispara um pedido HTTP por período ao mesmo tempo, e sem o
// dedupe os 45 pedidos viram 45 leituras simultâneas no Earth Engine.
const pendingRowsByAssetLocation = new Map<
  string,
  Promise<Record<string, unknown>[]>
>();

function readPositiveIntegerEnv(key: string, fallback: number) {
  const value = Number(process.env[key]);

  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

function getMaxEntries() {
  return readPositiveIntegerEnv(
    "GEE_STATISTICS_ROWS_CACHE_MAX_ENTRIES",
    DEFAULT_MAX_ENTRIES,
  );
}

function getMaxRows() {
  return readPositiveIntegerEnv(
    "GEE_STATISTICS_ROWS_CACHE_MAX_ROWS",
    DEFAULT_MAX_ROWS,
  );
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
  deleteEntry(key);
  rowsByAssetLocation.set(key, entry);
  cachedRowCount += entry.rows.length;
}

function deleteEntry(key: string) {
  const entry = rowsByAssetLocation.get(key);
  if (!entry) return;
  cachedRowCount -= entry.rows.length;
  rowsByAssetLocation.delete(key);
}

function evictLeastRecentlyUsed() {
  const maxEntries = getMaxEntries();
  const maxRows = getMaxRows();

  while (
    rowsByAssetLocation.size > maxEntries ||
    (cachedRowCount > maxRows && rowsByAssetLocation.size > 1)
  ) {
    const { value: oldestKey } = rowsByAssetLocation.keys().next();

    if (oldestKey === undefined) {
      return;
    }

    deleteEntry(oldestKey);
  }
}

function getFreshRows(key: string) {
  const entry = rowsByAssetLocation.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    deleteEntry(key);
    return null;
  }

  markAsRecentlyUsed(key, entry);
  return entry.rows;
}

/**
 * Linhas de um asset estatístico para um território, lidas uma única vez por
 * chave mesmo quando vários períodos são pedidos ao mesmo tempo.
 *
 * const rows = await getOrLoadStatisticsRows(key, () => readFromEarthEngine());
 */
export function getOrLoadStatisticsRows(
  key: string,
  loadRows: () => Promise<Record<string, unknown>[]>,
): Promise<Record<string, unknown>[]> {
  const cachedRows = getFreshRows(key);
  if (cachedRows) {
    return Promise.resolve(cachedRows);
  }

  const pending = pendingRowsByAssetLocation.get(key);
  if (pending) {
    return pending;
  }

  const request = loadRows()
    .then((rows) => {
      markAsRecentlyUsed(key, { rows, timestamp: Date.now() });
      evictLeastRecentlyUsed();
      return rows;
    })
    .finally(() => {
      pendingRowsByAssetLocation.delete(key);
    });

  pendingRowsByAssetLocation.set(key, request);
  return request;
}

export function clearGeeStatisticsRowsCache() {
  rowsByAssetLocation.clear();
  pendingRowsByAssetLocation.clear();
  cachedRowCount = 0;
}

export { CACHE_TTL_MS as GEE_STATISTICS_ROWS_CACHE_TTL_MS };
