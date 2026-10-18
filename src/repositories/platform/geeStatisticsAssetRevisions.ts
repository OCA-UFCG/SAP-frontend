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
}

/**
 * Compara a data de alteração das tabelas guardadas no cache com o momento em
 * que cada uma foi lida, e descarta só as entradas de tabelas que mudaram,
 * apareceram ou sumiram desde então.
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
  if (readTimes.size === 0) return { listedFolders: 0, invalidatedEntries: 0 };

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
  const invalidatedEntries = invalidateStatisticsRows((assetId, readAt) => {
    if (!listedFolders.has(getParentFolder(assetId))) return false;

    const time = updatedAt.get(assetId);
    // Fora da listagem: só conta como mudança se estava lá antes (foi apagado).
    // Um asset que nunca existiu já foi lido como indisponível.
    if (time === undefined) return previouslyListed?.has(assetId) ?? false;

    return time > readAt - PROPAGATION_MARGIN_MS;
  });

  const listedAssets = new Set(
    [...(previouslyListed ?? [])].filter(
      (assetId) => !listedFolders.has(getParentFolder(assetId)),
    ),
  );
  updatedAt.forEach((_time, assetId) => listedAssets.add(assetId));
  sharedState.__geeStatisticsListedAssets = listedAssets;

  if (invalidatedEntries > 0) {
    // As colunas de uma tabela reexportada podem ter mudado junto.
    clearGeeStatisticsSchemaCache();
    console.info(
      `[geeStatistics] ${invalidatedEntries} recorte(s) descartado(s) porque a tabela mudou no Earth Engine.`,
    );
  }

  return { listedFolders: listedFolders.size, invalidatedEntries };
}
