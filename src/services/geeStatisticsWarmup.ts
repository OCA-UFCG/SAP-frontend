import "server-only";

import { getGeeStatisticsSource } from "@/config/geeStatistics";
import { preloadGeeStatisticsSchema } from "@/repositories/platform/geeStatisticsRepository";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import { isCompactImageData } from "@/utils/imageData";

/**
 * Lê as colunas das tabelas do Earth Engine de todas as camadas assim que o
 * servidor sobe.
 *
 * Sem isso, o primeiro relatório municipal depois de cada deploy fazia essa
 * leitura no clique, uma ida por camada, e demorava o triplo dos seguintes. O
 * beta é reimplantado a cada merge na `main` e tem pouco movimento, então era
 * justamente esse o relatório que quase todo mundo via lá.
 *
 * Uma camada que falhar aqui não impede nada: ela só volta a ler as colunas na
 * hora em que for pedida, como antes.
 */
export async function warmGeeStatisticsSchemas(): Promise<void> {
  const panelLayers = await getPanelLayers();

  await Promise.allSettled(
    panelLayers.map(async (layer) => {
      if (!isCompactImageData(layer.imageData)) return;

      const source = layer.statisticsSource ?? getGeeStatisticsSource(layer.id);
      if (!source) return;

      await preloadGeeStatisticsSchema(
        source,
        Object.keys(layer.imageData.years).sort(),
      );
    }),
  );
}
