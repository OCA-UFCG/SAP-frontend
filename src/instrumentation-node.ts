import { warmGeeStatisticsSchemas } from "@/services/geeStatisticsWarmup";
import { startReferenceLayerUrlRefresh } from "@/app/api/ee/referenceLayers";

/**
 * Aquece as colunas das tabelas do Earth Engine para que o primeiro relatório
 * municipal depois de um deploy não pague essa leitura no clique, e prepara os
 * endereços dos territórios para que o primeiro clique num grupo também não.
 *
 * Não é aguardado: o servidor aceita pedidos enquanto o aquecimento termina, e
 * um relatório pedido nesse meio-tempo apenas reaproveita a leitura em
 * andamento.
 */
export function warmUpOnStartup() {
  if (!process.env.GEE_PRIVATE_KEY) return;

  startReferenceLayerUrlRefresh();

  const startedAt = Date.now();
  void warmGeeStatisticsSchemas().then(
    () => {
      console.info(
        `[geeStatistics] colunas aquecidas na subida em ${Date.now() - startedAt} ms`,
      );
    },
    (error: unknown) => {
      console.error(
        "[geeStatistics] falha ao aquecer as colunas na subida:",
        error,
      );
    },
  );
}
