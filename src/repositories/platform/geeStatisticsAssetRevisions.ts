import "server-only";

import {
  initializeGee,
  listGeeFolderAssetUpdateTimes,
} from "@/infrastructure/earth-engine/client";
import { clearGeeStatisticsSchemaCache } from "@/repositories/platform/geeStatisticsRepository";
import {
  getCachedStatisticsAssetReadTimes,
  invalidateStatisticsRows,
} from "@/repositories/platform/geeStatisticsRowsCache";
import {
  listMunicipalTableSnapshots,
  removeMunicipalTableSnapshot,
} from "@/repositories/platform/municipalTableSnapshot";

/**
 * Folga entre a alteração de uma tabela e a leitura que já a enxerga. Uma
 * leitura feita logo depois da troca pode ainda ter visto a versão antiga; com
 * a folga, ela é refeita uma vez na checagem seguinte.
 */
const PROPAGATION_MARGIN_MS = 5 * 60_000;

// Os assets vistos na última listagem, para perceber o que foi apagado. No
// `globalThis` porque a checagem roda na cópia do módulo da subida do servidor.
const sharedState = globalThis as typeof globalThis & {
  __geeStatisticsListedAssets?: Set<string>;
};

function getParentFolder(assetId: string): string {
  return assetId.slice(0, assetId.lastIndexOf("/"));
}

export interface StatisticsRevisionCheck {
  listedFolders: number;
  invalidatedEntries: number;
  /** Arquivos de tabelas municipais apagados por a tabela ter mudado. */
  removedMunicipalTables: number;
}

/**
 * Compara a data de alteração das tabelas guardadas no cache com o momento em
 * que cada uma foi lida, e descarta só as entradas de tabelas que mudaram,
 * apareceram ou sumiram desde então.
 *
 * Vale também para os arquivos das tabelas municipais
 * (`municipalTableSnapshot`): o de uma tabela que mudou é apagado, as leituras
 * dela voltam ao Earth Engine e `refreshMissingMunicipalTables` grava o novo.
 *
 * Custa uma listagem por pasta (as 24 fontes da produção moram numa só) e
 * nenhuma leitura de dados. Uma pasta que não puder ser listada não descarta
 * nada: o cache continua servindo até a próxima checagem ou até o prazo dele.
 *
 * @example
 * const { invalidatedEntries } = await checkStatisticsAssetRevisions();
 */
export async function checkStatisticsAssetRevisions(): Promise<StatisticsRevisionCheck> {
  const readTimes = getCachedStatisticsAssetReadTimes();
  const snapshots = await listMunicipalTableSnapshots();
  for (const { assetId, readAt } of snapshots) {
    readTimes.set(assetId, Math.min(readTimes.get(assetId) ?? readAt, readAt));
  }
  if (readTimes.size === 0) {
    return {
      listedFolders: 0,
      invalidatedEntries: 0,
      removedMunicipalTables: 0,
    };
  }

  await initializeGee();

  const folders = new Set([...readTimes.keys()].map(getParentFolder));
  const listedFolders = new Set<string>();
  const updatedAt = new Map<string, number>();

  for (const folder of folders) {
    try {
      const folderAssets = await listGeeFolderAssetUpdateTimes(folder);
      folderAssets.forEach((time, assetId) => updatedAt.set(assetId, time));
      listedFolders.add(folder);
    } catch (error) {
      console.warn(
        `[geeStatistics] não foi possível conferir as alterações em ${folder}; o cache dessa pasta segue valendo.`,
        error,
      );
    }
  }

  const previouslyListed = sharedState.__geeStatisticsListedAssets;
  const isStale = (assetId: string, readAt: number) => {
    if (!listedFolders.has(getParentFolder(assetId))) return false;

    const time = updatedAt.get(assetId);
    // Fora da listagem: só conta como mudança se estava lá antes (foi apagado).
    // Um asset que nunca existiu já foi lido como indisponível.
    if (time === undefined) return previouslyListed?.has(assetId) ?? false;

    return time > readAt - PROPAGATION_MARGIN_MS;
  };

  // O arquivo sai antes do cache: uma releitura que comece agora já não o acha.
  const staleTables = new Set(
    snapshots
      .filter(({ assetId, readAt }) => isStale(assetId, readAt))
      .map(({ assetId }) => assetId),
  );
  for (const assetId of staleTables) {
    await removeMunicipalTableSnapshot(assetId);
  }

  // Uma entrada lida do arquivo leva a hora em que foi lida do disco, não a da
  // tabela, então ela sai junto com o arquivo, qualquer que seja essa hora.
  const invalidatedEntries = invalidateStatisticsRows(
    (assetId, readAt) => staleTables.has(assetId) || isStale(assetId, readAt),
  );

  const listedAssets = new Set(
    [...(previouslyListed ?? [])].filter(
      (assetId) => !listedFolders.has(getParentFolder(assetId)),
    ),
  );
  updatedAt.forEach((_time, assetId) => listedAssets.add(assetId));
  sharedState.__geeStatisticsListedAssets = listedAssets;

  if (staleTables.size > 0) {
    // A tabela regravada pode ter colunas novas.
    clearGeeStatisticsSchemaCache();
    console.info(
      `[geeStatistics] ${staleTables.size} arquivo(s) de tabela municipal apagado(s) porque a tabela mudou no Earth Engine.`,
    );
  }

  if (invalidatedEntries > 0) {
    // As colunas de uma tabela reexportada podem ter mudado junto.
    clearGeeStatisticsSchemaCache();
    console.info(
      `[geeStatistics] ${invalidatedEntries} recorte(s) descartado(s) porque a tabela mudou no Earth Engine.`,
    );
  }

  return {
    listedFolders: listedFolders.size,
    invalidatedEntries,
    removedMunicipalTables: staleTables.size,
  };
}
