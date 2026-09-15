"use client";

import { useEffect, useMemo, useState } from "react";
import type { MunicipalityClassification } from "@/components/Map/classificationLayers";
import {
  buildSheetChoroplethPath,
  fetchSheetChoropleth,
  paintsMunicipalChoropleth,
} from "@/components/Map/sheetChoropleth";
import useCitiesOverview from "@/components/Amfe/useCitiesOverview";
import type { IEEInfo } from "@/utils/interfaces";

export { paintsMunicipalChoropleth };

export interface SheetChoroplethLayer {
  /** `true` quando a camada ativa é pintada município a município. */
  isSheetLayer: boolean;
  classification: MunicipalityClassification | null;
  overviewGeoJson: ReturnType<typeof useCitiesOverview>["overviewGeoJson"];
  isLoading: boolean;
}

/**
 * A coropleta da camada ativa do Monitoramento, quando ela vem de uma coluna da
 * planilha da análise multicritério.
 *
 * O GeoJSON de visão geral só é baixado quando existe uma camada dessas em
 * tela: quem nunca abre um índice de planilha não paga os ~490 KB dele.
 *
 * @example
 * const { classification, isLoading } = useSheetChoroplethLayer(activeEEData);
 */
export function useSheetChoroplethLayer(
  activeEEData: IEEInfo | null,
): SheetChoroplethLayer {
  const isSheetLayer = paintsMunicipalChoropleth(activeEEData);
  const panelLayerId = isSheetLayer ? (activeEEData?.id ?? null) : null;
  const requestPath = panelLayerId
    ? buildSheetChoroplethPath(panelLayerId, activeEEData?.tileApiPath)
    : null;
  const [response, setResponse] = useState<{
    panelLayerId: string;
    data: MunicipalityClassification | null;
  } | null>(null);
  const { overviewGeoJson } = useCitiesOverview(isSheetLayer);

  useEffect(() => {
    if (!panelLayerId || !requestPath) return;

    const controller = new AbortController();

    fetchSheetChoropleth(requestPath, controller.signal)
      .then((data) => setResponse({ panelLayerId, data }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(
          `[monitoramento] falha ao carregar a coropleta de ${panelLayerId}:`,
          error,
        );
        // Registrar a falha encerra a espera: sem isso o mapa ficaria com o
        // indicador de carregamento aceso para sempre.
        setResponse({ panelLayerId, data: null });
      });

    return () => controller.abort();
  }, [panelLayerId, requestPath]);

  const classification = useMemo<MunicipalityClassification | null>(() => {
    // A resposta anterior é descartada na troca de camada: pintar o mapa com a
    // classificação de outro índice enquanto a nova não chega mostraria cores
    // que não correspondem à legenda em tela.
    if (!panelLayerId || response?.panelLayerId !== panelLayerId) return null;
    return response.data;
  }, [panelLayerId, response]);

  return {
    isSheetLayer,
    classification,
    overviewGeoJson,
    isLoading: panelLayerId !== null && response?.panelLayerId !== panelLayerId,
  };
}
