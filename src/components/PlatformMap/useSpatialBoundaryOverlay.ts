"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection, Geometry } from "geojson";
import type { SpatialSelection } from "@/utils/spatialScope";
import { selectActiveBoundaryFeatures } from "@/utils/spatialBoundaryFeatures";

type SpatialBoundaryStatus = "idle" | "loading" | "ready" | "error";
type BoundaryCollection = FeatureCollection<Geometry, { name: string }>;

interface SpatialBoundaryOverlayResult {
  /** Tudo que o mapa desenha: em modo bioma, os seis biomas. */
  boundaryGeoJson: BoundaryCollection | null;
  /** Só o recorte selecionado, para quem enquadra a câmera. */
  activeBoundaryGeoJson: BoundaryCollection | null;
  status: SpatialBoundaryStatus;
}

const AREAS_WITH_BOUNDARY = new Set<string>(["biome", "semiarid", "asd"]);

/** A URL é a chave do cache: mesma resposta, mesma entrada. */
const boundaryCache = new Map<string, BoundaryCollection>();

/**
 * Esvazia o cache de contornos.
 *
 * O cache vive no módulo de propósito, para sobreviver a remontagens do mapa
 * dentro da mesma sessão; os testes precisam de um jeito de começar do zero.
 */
export function clearSpatialBoundaryCache() {
  boundaryCache.clear();
}

/**
 * URL do contorno para a seleção, ou `null` quando a área não tem contorno.
 *
 * Em modo bioma pedimos a área inteira (`scope=area`), porque o mapa precisa dos
 * biomas vizinhos desenhados para o hover e o clique trocarem de bioma. Como a
 * resposta não depende do bioma selecionado, a URL também não o inclui — assim
 * o navegador baixa e guarda uma cópia só, em vez de uma por bioma.
 */
function buildBoundaryRequestUrl(selection: SpatialSelection): string | null {
  if (!AREAS_WITH_BOUNDARY.has(selection.spatialArea)) return null;

  const params: Record<string, string> =
    selection.spatialArea === "biome"
      ? { spatialArea: "biome", scope: "area" }
      : {
          spatialArea: selection.spatialArea,
          spatialValue: selection.spatialValue,
        };

  return `/api/spatial-boundary?${new URLSearchParams(params).toString()}`;
}

export function useSpatialBoundaryOverlay(
  spatialSelection: SpatialSelection,
): SpatialBoundaryOverlayResult {
  const [fetchedState, setFetchedState] = useState<{
    url: string;
    geoJson: BoundaryCollection | null;
    status: "ready" | "error";
  } | null>(null);

  const latestUrlRef = useRef<string | null>(null);
  const requestUrl = buildBoundaryRequestUrl(spatialSelection);

  useEffect(() => {
    if (!requestUrl) {
      latestUrlRef.current = null;
      return;
    }

    latestUrlRef.current = requestUrl;

    if (boundaryCache.has(requestUrl)) {
      return;
    }

    const controller = new AbortController();

    const fetchBoundary = async () => {
      try {
        const response = await fetch(requestUrl, {
          signal: controller.signal,
        });

        if (latestUrlRef.current !== requestUrl) return;

        if (!response.ok) {
          console.error(`Spatial boundary fetch failed: ${response.status}`);
          setFetchedState({ url: requestUrl, geoJson: null, status: "error" });
          return;
        }

        const geoJson = (await response.json()) as BoundaryCollection;

        if (latestUrlRef.current !== requestUrl) return;

        boundaryCache.set(requestUrl, geoJson);
        setFetchedState({ url: requestUrl, geoJson, status: "ready" });
      } catch (err) {
        if (controller.signal.aborted) return;
        if (latestUrlRef.current !== requestUrl) return;

        console.error("Error fetching spatial boundary:", err);
        setFetchedState({ url: requestUrl, geoJson: null, status: "error" });
      }
    };

    fetchBoundary();

    return () => {
      controller.abort();
    };
    // Trocar de bioma não muda a URL: nem cancela o download em voo, nem repete
    // o pedido já respondido.
  }, [requestUrl]);

  const loaded = useMemo((): {
    boundaryGeoJson: BoundaryCollection | null;
    status: SpatialBoundaryStatus;
  } => {
    if (!requestUrl) {
      return { boundaryGeoJson: null, status: "idle" };
    }

    const cached = boundaryCache.get(requestUrl);
    if (cached) {
      return { boundaryGeoJson: cached, status: "ready" };
    }

    if (fetchedState?.url === requestUrl) {
      return {
        boundaryGeoJson: fetchedState.geoJson,
        status: fetchedState.status,
      };
    }

    return { boundaryGeoJson: null, status: "loading" };
  }, [requestUrl, fetchedState]);

  const activeBoundaryGeoJson = useMemo(
    () =>
      selectActiveBoundaryFeatures(
        loaded.boundaryGeoJson,
        spatialSelection.spatialValue,
      ),
    [loaded.boundaryGeoJson, spatialSelection.spatialValue],
  );

  return { ...loaded, activeBoundaryGeoJson };
}
