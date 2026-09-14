"use client";

import { useEffect, useMemo, useState } from "react";
import type { MunicipalityClassification } from "@/components/Map/classificationLayers";
import useCitiesOverview from "@/components/Amfe/useCitiesOverview";
import type { IEEInfo } from "@/utils/interfaces";
import { isCompactImageData } from "@/utils/imageData";

interface SheetChoroplethResponse {
  classificationByCode: Record<string, number>;
  excludedCodes: string[];
  palette: string[];
}

export interface SheetChoroplethLayer {
  /** `true` quando a camada ativa é pintada município a município. */
  isSheetLayer: boolean;
  classification: MunicipalityClassification | null;
  overviewGeoJson: ReturnType<typeof useCitiesOverview>["overviewGeoJson"];
  isLoading: boolean;
}

/**
 * Diz se a camada declara que o mapa dela é uma coropleta municipal. A marca
 * viaja no `imageData` justamente para o cliente decidir isso sem um segundo
 * pedido ao servidor — é ela que evita pedir tile ao `/api/ee` para um índice
 * que não tem raster nenhum.
 */
export function paintsMunicipalChoropleth(
  activeEEData: IEEInfo | null,
): boolean {
  if (!activeEEData || !isCompactImageData(activeEEData.imageData)) {
    return false;
  }

  return Boolean(activeEEData.imageData.mapVisualization?.municipalChoropleth);
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
  // A prévia do catálogo desenha um rascunho, que ainda não é um `panelLayer`
  // publicado: ela aponta o mapa para as rotas do rascunho pelo `tileApiPath`, e
  // a coropleta segue o mesmo endereço.
  const requestPath = panelLayerId
    ? activeEEData?.tileApiPath
      ? `${activeEEData.tileApiPath.replace(/\/ee$/u, "")}/choropleth`
      : `/api/municipal-analysis/${encodeURIComponent(panelLayerId)}/choropleth`
    : null;
  const [response, setResponse] = useState<{
    panelLayerId: string;
    data: SheetChoroplethResponse | null;
  } | null>(null);
  const { overviewGeoJson } = useCitiesOverview(isSheetLayer);

  useEffect(() => {
    if (!panelLayerId || !requestPath) return;

    const controller = new AbortController();

    fetch(requestPath, { signal: controller.signal })
      .then(async (result) => {
        if (!result.ok) {
          throw new Error(`Choropleth request failed with ${result.status}`);
        }
        return (await result.json()) as SheetChoroplethResponse;
      })
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
    if (!response.data) return null;

    return {
      classificationByCode: response.data.classificationByCode,
      excludedCodes: response.data.excludedCodes,
      palette: response.data.palette,
    };
  }, [panelLayerId, response]);

  return {
    isSheetLayer,
    classification,
    overviewGeoJson,
    isLoading: panelLayerId !== null && response?.panelLayerId !== panelLayerId,
  };
}
