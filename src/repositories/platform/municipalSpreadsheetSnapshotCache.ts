import {
  parseMunicipalSpreadsheetSnapshot,
  type MunicipalSpreadsheetSnapshot,
} from "@/contracts/municipalSpreadsheetSnapshot";

/**
 * O instantâneo só muda quando o operador revalida o índice no catálogo, e a
 * revalidação grava um asset novo. Uma hora de TTL é generosa de propósito: o
 * arquivo tem centenas de KB e relê-lo a cada dez minutos custaria mais do que
 * a chance de estar velho.
 */
const SNAPSHOT_TTL_MS = 1000 * 60 * 60;

/**
 * Cada entrada é a planilha inteira de um índice (~500 KB). Poucos índices
 * virão de planilha, e o teto existe para o processo não crescer sem limite se
 * um dia vierem muitos.
 */
const MAX_SNAPSHOTS = 12;

interface SnapshotEntry {
  snapshot: MunicipalSpreadsheetSnapshot;
  timestamp: number;
}

const snapshotsByUrl = new Map<string, SnapshotEntry>();
// Uma promessa por URL em voo. Sem ela, um início a frio com vários usuários no
// mesmo índice vira uma cópia do arquivo por usuário — é a mesma razão do
// `pending` de `municipalAnalysisCache`.
const pendingByUrl = new Map<string, Promise<MunicipalSpreadsheetSnapshot>>();

function getFreshSnapshot(url: string) {
  const entry = snapshotsByUrl.get(url);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > SNAPSHOT_TTL_MS) {
    snapshotsByUrl.delete(url);
    return null;
  }
  // Map preserva ordem de inserção: reinserir deixa a menos usada em primeiro
  // lugar e torna a evicção O(1).
  snapshotsByUrl.delete(url);
  snapshotsByUrl.set(url, entry);
  return entry.snapshot;
}

function storeSnapshot(url: string, snapshot: MunicipalSpreadsheetSnapshot) {
  snapshotsByUrl.set(url, { snapshot, timestamp: Date.now() });
  while (snapshotsByUrl.size > MAX_SNAPSHOTS) {
    const { value: oldest } = snapshotsByUrl.keys().next();
    if (oldest === undefined) return;
    snapshotsByUrl.delete(oldest);
  }
}

async function downloadSnapshot(
  url: string,
  fetchSnapshot: typeof fetch,
): Promise<MunicipalSpreadsheetSnapshot> {
  const response = await fetchSnapshot(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `[municipalSpreadsheet] o instantâneo ${url} respondeu ${response.status}.`,
    );
  }
  return parseMunicipalSpreadsheetSnapshot(await response.json());
}

/**
 * O instantâneo de valores de um índice de planilha, lido uma vez por URL.
 *
 * @example
 * const snapshot = await getOrLoadSpreadsheetSnapshot(source.snapshot.url);
 * snapshot.values["2507507"]; // [12345, null]
 */
export function getOrLoadSpreadsheetSnapshot(
  url: string,
  fetchSnapshot: typeof fetch = fetch,
): Promise<MunicipalSpreadsheetSnapshot> {
  const cached = getFreshSnapshot(url);
  if (cached) return Promise.resolve(cached);

  const pending = pendingByUrl.get(url);
  if (pending) return pending;

  const request = downloadSnapshot(url, fetchSnapshot)
    .then((snapshot) => {
      storeSnapshot(url, snapshot);
      return snapshot;
    })
    .finally(() => {
      pendingByUrl.delete(url);
    });

  pendingByUrl.set(url, request);
  return request;
}

export function clearSpreadsheetSnapshotCache() {
  snapshotsByUrl.clear();
  pendingByUrl.clear();
}

export { SNAPSHOT_TTL_MS as SPREADSHEET_SNAPSHOT_TTL_MS };
