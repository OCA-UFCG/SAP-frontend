"use client";

import { useEffect, useMemo, useState } from "react";
import useCitiesOverview from "@/components/Amfe/useCitiesOverview";
import type { MunicipalityOverviewGeoJson } from "@/components/Map/classificationLayers";
import { isCompactImageData } from "@/utils/imageData";
import type { IEEInfo } from "@/utils/interfaces";
import { classifyValueByThresholds } from "@/utils/valueThresholds";

export interface IndexChoropleth {
  palette: string[];
  /** Código IBGE de 7 dígitos → posição da faixa de cor. */
  classByCode: Record<string, number>;
  overviewGeoJson: MunicipalityOverviewGeoJson | null;
}

/**
 * O que basta para saber se uma camada é coropleta e de onde vêm os seus
 * valores. É menos que `IEEInfo` porque a captura da imagem de prévia do
 * catálogo monta o mapa a partir da prévia validada, que não é um `IEEInfo`.
 */
export type ChoroplethLayerSource = Pick<
  IEEInfo,
  "imageData" | "municipalAnalysisApiPath"
> & { id: string };

interface ChoroplethConfig {
  /** Rota que devolve o valor de cada município do período. */
  valuesUrl: string;
  palette: string[];
  thresholds: number[];
}

/**
 * A rota dos valores municipais da camada ativa.
 *
 * Um índice em rascunho no catálogo ainda não tem `panelLayer` publicado, e por
 * isso é lido pela rota do próprio rascunho — a mesma divisão que já existe
 * para os tiles e para o painel de análise.
 */
function resolveChoroplethValuesUrl(
  activeEEData: ChoroplethLayerSource,
): string {
  return activeEEData.municipalAnalysisApiPath
    ? `${activeEEData.municipalAnalysisApiPath}/choropleth`
    : `/api/municipal-analysis/${encodeURIComponent(activeEEData.id)}/choropleth`;
}

/**
 * A configuração de coropleta de uma camada, ou `null` quando o mapa dela vem
 * do Earth Engine — que é o caso de todos os índices menos os criados a partir
 * de planilha.
 */
export function resolveChoroplethConfig(
  activeEEData: ChoroplethLayerSource | null,
): ChoroplethConfig | null {
  const imageData = activeEEData?.imageData;
  if (!activeEEData || !isCompactImageData(imageData)) return null;

  const mapVisualization = imageData.mapVisualization;
  if (mapVisualization?.sourceType !== "municipalChoropleth") return null;

  return {
    valuesUrl: resolveChoroplethValuesUrl(activeEEData),
    palette: mapVisualization.palette ?? [],
    thresholds: mapVisualization.thresholds ?? [],
  };
}

export async function fetchMunicipalValues(
  valuesUrl: string,
  year: string,
  signal?: AbortSignal,
) {
  const response = await fetch(
    `${valuesUrl}?year=${encodeURIComponent(year)}`,
    {
      signal,
    },
  );
  if (!response.ok) {
    throw new Error(
      `A leitura dos valores municipais em ${valuesUrl} para ${year} respondeu ${response.status}.`,
    );
  }
  const payload = (await response.json()) as {
    values?: Record<string, number>;
  };
  return payload.values ?? {};
}

/**
 * A faixa de cor de cada município. A mesma regra de limites que o servidor usa
 * para pintar um raster no Earth Engine, para a legenda dizer a verdade nos
 * dois casos.
 */
export function toClassByCode(
  values: Record<string, number>,
  thresholds: number[],
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(values).map(([code, value]) => [
      code,
      classifyValueByThresholds(value, thresholds, 0),
    ]),
  );
}

export type IndexChoroplethStatus = "idle" | "loading" | "ready" | "error";

interface LoadedChoropleth {
  /** Identifica de quem são os valores guardados: camada e período. */
  requestKey: string;
  classByCode: Record<string, number>;
  status: Exclude<IndexChoroplethStatus, "idle" | "loading">;
}

/**
 * Os valores municipais do índice ativo, quando ele é uma coropleta.
 *
 * O resultado carrega a chave do pedido que o produziu, e não é apagado ao
 * trocar de camada: comparar a chave é o que impede o mapa de pintar por um
 * instante os valores do índice anterior, sem custar um render a mais só para
 * limpar o estado.
 *
 * O GeoJSON de visão geral só é baixado quando existe uma coropleta na tela: é
 * o mesmo arquivo de 1,9 MB da análise multicritério, e não faz sentido
 * carregá-lo para quem está vendo um índice do Earth Engine.
 *
 * @example
 * const { choropleth, status } = useIndexChoroplethValues(activeEEData, "2023");
 */
export function useIndexChoroplethValues(
  activeEEData: IEEInfo | null,
  activeYear: string,
): { choropleth: IndexChoropleth | null; status: IndexChoroplethStatus } {
  const config = useMemo(
    () => resolveChoroplethConfig(activeEEData),
    [activeEEData],
  );
  const requestKey = config ? `${config.valuesUrl}:${activeYear}` : null;
  const [loaded, setLoaded] = useState<LoadedChoropleth | null>(null);
  const { overviewGeoJson } = useCitiesOverview(Boolean(config));

  useEffect(() => {
    if (!config || !activeYear || !requestKey) return;

    let cancelled = false;
    fetchMunicipalValues(config.valuesUrl, activeYear)
      .then((values) => {
        if (cancelled) return;
        setLoaded({
          requestKey,
          classByCode: toClassByCode(values, config.thresholds),
          status: "ready",
        });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[indexChoropleth]", error);
        setLoaded({ requestKey, classByCode: {}, status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [activeYear, config, requestKey]);

  const current = loaded?.requestKey === requestKey ? loaded : null;
  const status: IndexChoroplethStatus = !requestKey
    ? "idle"
    : (current?.status ?? "loading");

  const choropleth = useMemo(
    () =>
      config && current?.status === "ready"
        ? {
            palette: config.palette,
            classByCode: current.classByCode,
            overviewGeoJson,
          }
        : null,
    [config, current, overviewGeoJson],
  );

  return { choropleth, status };
}
