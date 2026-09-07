import "server-only";

import { createHash } from "node:crypto";

// As estatísticas moram em assets publicados do Earth Engine: mudam quando
// alguém republica o índice, e não ao longo do dia. Os dez minutos daqui eram
// herdados do cache de conteúdo do Contentful, que editores mexem a qualquer
// hora, e faziam a primeira leitura de cada estado — de 3 a 6 s de Earth Engine
// — se repetir várias vezes por dia sem que o dado tivesse mudado. As rotas de
// publicação do catálogo chamam `clearGeeStatisticsRowsCache`, então uma
// republicação continua aparecendo na hora, com validade longa ou curta; o que
// a validade longa atrasa é só a atualização feita direto no Earth Engine, fora
// da plataforma.
const DEFAULT_CACHE_TTL_SECONDS = 60 * 60 * 12;
// Uma entrada é o recorte de um território dentro de uma série de assets:
// ~1260 linhas para `br` no índice de aridez do ERA5-Land (Brasil + 27 estados
// x 45 anos, ~390 KiB) e de ~8000 a ~38 000 para uma UF, desde que a leitura
// municipal passou a trazer o estado inteiro. O teto existe para uma navegação
// longa por municípios não fazer o mapa crescer sem fim.
const DEFAULT_MAX_ENTRIES = 200;
// Só contar entradas deixou de descrever a memória usada quando elas passaram a
// diferir em duas ordens de grandeza: 200 entradas de UF seriam centenas de MB.
// O teto de linhas é o que mantém o gasto previsível. Medido no índice de
// aridez do ERA5-Land, 250 785 linhas de 16 colunas ocupam 142 MB de heap, ou
// ~0,58 KiB por linha, então 120 mil linhas custam ~70 MB — a mesma faixa das
// 200 entradas de ~400 KiB do cache de `municipalAnalysis`. Cabem juntos os
// cinco estados semiáridos com mais municípios na camada mais pesada
// (Minas Gerais 38 385 + Bahia 18 765 + Paraíba 10 035 + Pernambuco 8325 +
// Ceará 8280 = 83 790 linhas).
const DEFAULT_MAX_ROWS = 120_000;

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

function getCacheTtlMs() {
  return (
    readPositiveIntegerEnv(
      "GEE_STATISTICS_ROWS_CACHE_TTL_SECONDS",
      DEFAULT_CACHE_TTL_SECONDS,
    ) * 1000
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

  if (Date.now() - entry.timestamp > getCacheTtlMs()) {
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

export { getCacheTtlMs as getGeeStatisticsRowsCacheTtlMs };
