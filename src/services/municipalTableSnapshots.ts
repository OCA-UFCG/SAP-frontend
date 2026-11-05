import "server-only";

import { getGeeStatisticsSource } from "@/config/geeStatistics";
import {
  describeGeeStatisticsMunicipalTables,
  readGeeStatisticsMunicipalTable,
} from "@/repositories/platform/geeStatisticsRepository";
import {
  hasMunicipalTableSnapshotDir,
  listMunicipalTableSnapshots,
  writeMunicipalTableSnapshot,
  type MunicipalTableLayout,
} from "@/repositories/platform/municipalTableSnapshot";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import { isCompactImageData } from "@/utils/imageData";

/**
 * Depois de uma tabela falhar, quanto tempo o servidor espera para tentar de
 * novo. Sem isso, uma tabela que nunca passa (uma célula vazia, por exemplo)
 * seria lida inteira a cada 10 minutos.
 */
const FAILED_TABLE_RETRY_MS = 6 * 60 * 60_000;

const sharedState = globalThis as typeof globalThis & {
  __municipalTablesFailedAt?: Map<string, number>;
  __municipalTablesRefreshing?: boolean;
};
const failedAtByAsset = (sharedState.__municipalTablesFailedAt ??= new Map());

/**
 * As tabelas que o relatório de um município lê, com as colunas de cada uma.
 * Duas camadas na mesma tabela pedindo colunas diferentes somam as colunas
 * num arquivo só.
 *
 * Uma camada que não se deixa descrever (tabela fora do ar ao ler as colunas)
 * fica de fora: o relatório lê essa camada do Earth Engine, como antes.
 */
export async function planMunicipalTables(): Promise<
  Map<string, MunicipalTableLayout>
> {
  const plan = new Map<string, MunicipalTableLayout>();

  for (const layer of await getPanelLayers()) {
    if (!isCompactImageData(layer.imageData)) continue;

    const source = layer.statisticsSource ?? getGeeStatisticsSource(layer.id);
    if (!source) continue;

    try {
      const tables = await describeGeeStatisticsMunicipalTables(
        source,
        Object.keys(layer.imageData.years).sort(),
      );
      if (!tables) continue;

      for (const assetId of tables.assetIds) {
        const current = plan.get(assetId);
        plan.set(assetId, {
          ...tables.layout,
          columns: [
            ...new Set([...(current?.columns ?? []), ...tables.layout.columns]),
          ],
        });
      }
    } catch (error) {
      console.warn(
        `[municipalTables] ${layer.id} fica fora dos arquivos e será lido do Earth Engine:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return plan;
}

/**
 * Lê uma tabela inteira do Earth Engine e grava o arquivo dela. Devolve
 * quantas linhas municipais foram gravadas.
 */
export async function buildMunicipalTable(
  assetId: string,
  layout: MunicipalTableLayout,
): Promise<number> {
  // A hora de antes da leitura: uma alteração no meio dela fica mais nova que
  // o arquivo e é percebida pela conferência seguinte.
  const readAt = Date.now();
  const rows = await readGeeStatisticsMunicipalTable(assetId, layout);
  await writeMunicipalTableSnapshot(assetId, layout, rows, readAt);
  return rows.length;
}

/**
 * Grava as tabelas que faltam na pasta: as de um período publicado depois do
 * deploy, as que a conferência de alterações apagou por terem mudado no Earth
 * Engine e as que tinham mais colunas pedidas do que o arquivo guarda.
 *
 * Uma tabela por vez, para não ocupar as vagas de leitura do Earth Engine de
 * quem está usando a plataforma. Só roda onde a pasta existe — a imagem do
 * deploy —, e não em quem desenvolve.
 *
 * @example
 * const { built, failed } = await refreshMissingMunicipalTables();
 */
export async function refreshMissingMunicipalTables(): Promise<{
  built: number;
  failed: number;
}> {
  if (
    sharedState.__municipalTablesRefreshing ||
    !(await hasMunicipalTableSnapshotDir())
  ) {
    return { built: 0, failed: 0 };
  }

  sharedState.__municipalTablesRefreshing = true;
  try {
    const columnsOnDisk = new Map(
      (await listMunicipalTableSnapshots()).map((snapshot) => [
        snapshot.assetId,
        new Set(snapshot.columns),
      ]),
    );
    let built = 0;
    let failed = 0;

    for (const [assetId, layout] of await planMunicipalTables()) {
      const columns = columnsOnDisk.get(assetId);
      if (columns && layout.columns.every((column) => columns.has(column))) {
        continue;
      }
      if (
        Date.now() - (failedAtByAsset.get(assetId) ?? 0) <
        FAILED_TABLE_RETRY_MS
      )
        continue;

      try {
        await buildMunicipalTable(assetId, layout);
        failedAtByAsset.delete(assetId);
        built += 1;
      } catch (error) {
        failedAtByAsset.set(assetId, Date.now());
        failed += 1;
        console.warn(
          `[municipalTables] ${assetId} segue sem arquivo e será lido do Earth Engine:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    return { built, failed };
  } finally {
    sharedState.__municipalTablesRefreshing = false;
  }
}
