import "server-only";

import { getGeeStatisticsSource } from "@/config/geeStatistics";
import { isMunicipalSpreadsheetSource } from "@/contracts/municipalSpreadsheet";
import { checkStatisticsAssetRevisions } from "@/repositories/platform/geeStatisticsAssetRevisions";
import { preloadGeeStatisticsSchema } from "@/repositories/platform/geeStatisticsRepository";
import {
  getPanelLayers,
  getPanelLayerWithMunicipalAnalysisYear,
} from "@/repositories/platform/panelLayerRepository";
import { isCompactImageData } from "@/utils/imageData";

/**
 * De quanto em quanto tempo o servidor confere se alguma tabela mudou no Earth
 * Engine e repõe o recorte Brasil que estiver faltando. Uma tabela trocada
 * aparece no site em até esse tempo, o mesmo de quando o cache vencia a cada
 * 10 min — só que agora o resto do cache não é jogado fora junto.
 */
export const GEE_STATISTICS_REFRESH_MS = 10 * 60_000;

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

/**
 * Garante em cache o recorte Brasil de cada camada com estatística no Earth
 * Engine — é nele que o Detalhamento abre, e dele também saem os 27 estados.
 *
 * Passa pelo mesmo caminho da rota do Detalhamento, então a entrada guardada é
 * exatamente a que a rota vai procurar; o que já está em cache volta na hora e
 * não custa nada. As camadas vão uma por vez para não ocupar as vagas de
 * leitura de quem está usando a plataforma.
 */
export async function warmGeeStatisticsNationalRows(): Promise<number> {
  const panelLayers = await getPanelLayers();
  let warmed = 0;

  for (const layer of panelLayers) {
    if (!isCompactImageData(layer.imageData)) continue;

    const source = layer.statisticsSource ?? getGeeStatisticsSource(layer.id);
    if (!source || isMunicipalSpreadsheetSource(source)) continue;

    const latestPeriod = Object.keys(layer.imageData.years).sort().at(-1);
    if (!latestPeriod) continue;

    try {
      await getPanelLayerWithMunicipalAnalysisYear(
        layer.id,
        latestPeriod,
        "br",
      );
      warmed += 1;
    } catch (error) {
      console.warn(
        `[geeStatistics] falha ao aquecer o recorte Brasil de ${layer.id}; ele será lido no primeiro pedido.`,
        error,
      );
    }
  }

  return warmed;
}

async function refreshGeeStatistics() {
  try {
    await checkStatisticsAssetRevisions();
  } catch (error) {
    console.warn(
      "[geeStatistics] falha ao conferir alterações das tabelas:",
      error,
    );
  }

  const startedAt = Date.now();
  const warmed = await warmGeeStatisticsNationalRows();
  const elapsedMs = Date.now() - startedAt;
  // Só registra quando houve leitura de verdade: com tudo em cache, a volta
  // inteira leva poucos milissegundos.
  if (elapsedMs > 1000) {
    console.info(
      `[geeStatistics] recorte Brasil de ${warmed} camada(s) aquecido em ${elapsedMs} ms`,
    );
  }
}

// No `globalThis` para uma segunda cópia deste módulo não abrir um segundo ciclo.
const refreshState = globalThis as typeof globalThis & {
  __geeStatisticsRefresh?: boolean;
};

/**
 * Aquece o recorte Brasil agora e repete a cada `GEE_STATISTICS_REFRESH_MS`,
 * conferindo antes de cada volta se alguma tabela mudou no Earth Engine.
 */
export function startGeeStatisticsRefresh(): void {
  if (refreshState.__geeStatisticsRefresh) return;
  refreshState.__geeStatisticsRefresh = true;

  void refreshGeeStatistics();
  setInterval(() => {
    void refreshGeeStatistics();
  }, GEE_STATISTICS_REFRESH_MS).unref?.();
}
