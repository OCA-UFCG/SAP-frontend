import "server-only";

import type { MunicipalSpreadsheetStatisticsSource } from "@/contracts/municipalSpreadsheet";
import type { MunicipalSpreadsheetSnapshot } from "@/contracts/municipalSpreadsheetSnapshot";
import {
  readSpreadsheetSnapshot,
  type SpreadsheetSnapshotReaderDependencies,
} from "@/services/indexCatalog/spreadsheetSnapshotReader";

/**
 * O instantâneo de um índice em rascunho vive só na memória do processo: a
 * prévia do catálogo precisa dos valores, mas gravá-los no Contentful antes de
 * publicar mexeria no arquivo que a produção lê. Meia hora cobre a sessão de um
 * operador conferindo painel, mapa e relatório; passada ela, a planilha é lida
 * de novo, que é barato e sempre traz o dado atual.
 */
const DRAFT_SNAPSHOT_TTL_MS = 1000 * 60 * 30;

/** Cada entrada é a planilha agregada de um índice (~400 KB). */
const MAX_DRAFT_SNAPSHOTS = 4;

interface DraftSnapshotEntry {
  snapshot: MunicipalSpreadsheetSnapshot;
  timestamp: number;
}

const snapshotsBySource = new Map<string, DraftSnapshotEntry>();
// Uma promessa por planilha em voo: sem ela, abrir a prévia com painel, mapa e
// relatório ao mesmo tempo baixaria o mesmo arquivo do Drive três vezes.
const pendingBySource = new Map<
  string,
  Promise<MunicipalSpreadsheetSnapshot>
>();

function draftSnapshotKey(source: MunicipalSpreadsheetStatisticsSource) {
  return `${source.fileId}|${source.valuePrefix}|${source.aggregation}`;
}

function getFreshSnapshot(key: string) {
  const entry = snapshotsBySource.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > DRAFT_SNAPSHOT_TTL_MS) {
    snapshotsBySource.delete(key);
    return null;
  }
  // Map preserva ordem de inserção: reinserir deixa a menos usada em primeiro
  // lugar e torna a evicção O(1).
  snapshotsBySource.delete(key);
  snapshotsBySource.set(key, entry);
  return entry.snapshot;
}

function storeSnapshot(key: string, snapshot: MunicipalSpreadsheetSnapshot) {
  snapshotsBySource.set(key, { snapshot, timestamp: Date.now() });
  while (snapshotsBySource.size > MAX_DRAFT_SNAPSHOTS) {
    const { value: oldest } = snapshotsBySource.keys().next();
    if (oldest === undefined) return;
    snapshotsBySource.delete(oldest);
  }
}

/**
 * Guarda o instantâneo que a validação acabou de calcular, para a prévia não
 * reler a planilha logo em seguida.
 */
export function rememberDraftSpreadsheetSnapshot(
  source: MunicipalSpreadsheetStatisticsSource,
  snapshot: MunicipalSpreadsheetSnapshot,
) {
  storeSnapshot(draftSnapshotKey(source), snapshot);
}

/**
 * Os valores de um índice de planilha ainda em rascunho.
 *
 * Diferente da produção, que lê o asset publicado, aqui a fonte é a própria
 * planilha: o rascunho pode nem ter um asset ainda, e o que já existe pertence
 * à versão publicada do índice.
 *
 * @example
 * const snapshot = await getDraftSpreadsheetSnapshot(config.statisticsSource);
 */
export function getDraftSpreadsheetSnapshot(
  source: MunicipalSpreadsheetStatisticsSource,
  dependencies: SpreadsheetSnapshotReaderDependencies = {},
): Promise<MunicipalSpreadsheetSnapshot> {
  const key = draftSnapshotKey(source);
  const cached = getFreshSnapshot(key);
  if (cached) return Promise.resolve(cached);

  const pending = pendingBySource.get(key);
  if (pending) return pending;

  const request = readSpreadsheetSnapshot(source, dependencies)
    .then((reading) => {
      storeSnapshot(key, reading.snapshot);
      return reading.snapshot;
    })
    .finally(() => {
      pendingBySource.delete(key);
    });

  pendingBySource.set(key, request);
  return request;
}

export function clearDraftSpreadsheetSnapshots() {
  snapshotsBySource.clear();
  pendingBySource.clear();
}

export { DRAFT_SNAPSHOT_TTL_MS };
