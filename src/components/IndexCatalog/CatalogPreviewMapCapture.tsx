"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  catalogApiRequest,
  catalogIdempotencyKey,
} from "@/components/IndexCatalog/catalogApiClient";
import { captureMapCanvasPng } from "@/components/Map/captureMapCanvas";
import { BRAZIL_RASTER_BOUNDS } from "@/components/Map/mapBounds";
import { BASE_STYLE, ensureMapLayers } from "@/components/Map/mapDefinitions";
import { fetchMapURL } from "@/services/mapServices";
import type { IndexCatalogPreview } from "@/types/indexCatalog";
import { getImageDataYearKeys, isCompactImageData } from "@/utils/imageData";

/**
 * A captura sai do canvas do mapa, então a resolução seria a da tela do
 * operador. Fixamos 2x para a imagem do cartão não depender do monitor usado.
 */
const PREVIEW_MAP_PIXEL_RATIO = 2;

type PreviewMapStage = "capturing" | "saving" | "saved" | "failed";

interface SavedPreviewMapResponse {
  url: string;
  requiresRepublish: boolean;
}

/** O cartão ilustra o índice inteiro, então usamos o período padrão do mapa. */
export function resolvePreviewMapPeriod(preview: IndexCatalogPreview) {
  const { imageData } = preview.panelLayer;
  return (
    (isCompactImageData(imageData) ? imageData.defaultYear : undefined) ??
    preview.validation.inferred.defaultPeriod ??
    getImageDataYearKeys(imageData).at(-1) ??
    ""
  );
}

function stageMessage(
  stage: PreviewMapStage,
  requiresRepublish: boolean,
  failureReason: string,
) {
  if (stage === "capturing") return "Desenhando o mapa para capturar a imagem…";
  if (stage === "saving") return "Guardando a imagem no Contentful…";
  if (stage === "failed") return failureReason;
  return requiresRepublish
    ? "Imagem guardada. Ela aparece no Monitoramento na próxima publicação deste índice."
    : "Imagem guardada. Ela será publicada junto com o índice.";
}

export function CatalogPreviewMapCapture({
  preview,
  onSaved,
}: {
  preview: IndexCatalogPreview;
  onSaved?: (url: string) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [stage, setStage] = useState<PreviewMapStage>("capturing");
  const [image, setImage] = useState<{ key: string; src: string } | null>(null);
  const [requiresRepublish, setRequiresRepublish] = useState(false);
  const [failureReason, setFailureReason] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onSavedRef = useRef(onSaved);
  const { entryId } = preview;
  const { id: panelLayerId, name, tileApiPath } = preview.panelLayer;
  const period = resolvePreviewMapPeriod(preview);
  // A captura é identificada pelo período e pela tentativa: a imagem antiga
  // desaparece sozinha quando a chave muda, sem reset dentro do efeito.
  const captureKey = `${entryId}:${period}:${attempt}`;
  const imageSrc = image?.key === captureKey ? image.src : null;

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  const releaseMap = useCallback(() => {
    const map = mapRef.current;
    mapRef.current = null;
    map?.remove();
  }, []);

  useEffect(() => {
    let aborted = false;
    let settled = false;
    const controller = new AbortController();

    async function savePreviewMap(dataUrl: string) {
      setImage({ key: captureKey, src: dataUrl });
      setStage("saving");
      const saved = await catalogApiRequest<SavedPreviewMapResponse>(
        `/api/index-catalog/drafts/${encodeURIComponent(entryId)}/preview-map`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": catalogIdempotencyKey("preview-map", entryId),
          },
          body: JSON.stringify({ image: dataUrl }),
        },
      );
      if (aborted) return;
      setRequiresRepublish(saved.requiresRepublish);
      setStage("saved");
      onSavedRef.current?.(saved.url);
    }

    async function settle(dataUrl: string | null) {
      if (aborted || settled) return;
      settled = true;
      // A imagem já está capturada: o contexto WebGL não é mais necessário.
      window.setTimeout(releaseMap, 0);

      if (!dataUrl) {
        setStage("failed");
        setFailureReason(
          "O navegador não conseguiu capturar o mapa. Tente gerar novamente.",
        );
        return;
      }

      try {
        await savePreviewMap(dataUrl);
      } catch (reason) {
        if (aborted) return;
        setStage("failed");
        setFailureReason(
          reason instanceof Error
            ? reason.message
            : "Não foi possível guardar a imagem de prévia.",
        );
      }
    }

    async function capturePreviewMap() {
      setStage("capturing");
      setFailureReason("");
      const tileUrl = await fetchMapURL(
        panelLayerId,
        period,
        controller.signal,
        undefined,
        undefined,
        tileApiPath,
      );
      if (aborted || !containerRef.current) return;

      releaseMap();
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: BASE_STYLE,
        bounds: BRAZIL_RASTER_BOUNDS,
        fitBoundsOptions: { padding: 12, animate: false },
        interactive: false,
        attributionControl: false,
        preserveDrawingBuffer: true,
        pixelRatio: PREVIEW_MAP_PIXEL_RATIO,
      } as maplibregl.MapOptions);
      mapRef.current = map;

      map.on("load", () => {
        if (aborted) return;
        ensureMapLayers(map, "platform", true, false, tileUrl);
      });
      map.on("webglcontextlost", () => void settle(null));
      map.on("idle", () => void settle(captureMapCanvasPng(map)));
    }

    capturePreviewMap().catch((reason) => {
      if (reason instanceof DOMException && reason.name === "AbortError")
        return;
      if (aborted || settled) return;
      settled = true;
      setStage("failed");
      setFailureReason(
        reason instanceof Error
          ? reason.message
          : "Não foi possível montar o mapa da prévia.",
      );
    });

    return () => {
      aborted = true;
      controller.abort();
      releaseMap();
    };
  }, [captureKey, entryId, panelLayerId, period, releaseMap, tileApiPath]);

  const busy = stage === "capturing" || stage === "saving";

  return (
    <div className="rounded-lg border border-[#D6D89A] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold">Imagem de prévia do mapa</h3>
        <button
          type="button"
          className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          disabled={busy}
          onClick={() => setAttempt((current) => current + 1)}
        >
          Gerar novamente
        </button>
      </div>
      <p className="mt-1 text-xs text-stone-600">
        Capturada do mapa do período {period || "padrão"}. É a imagem que
        ilustra o índice na lista do Monitoramento.
      </p>
      <div className="mt-3 flex flex-wrap items-start gap-4">
        <div className="relative h-[280px] w-[280px] shrink-0 overflow-hidden rounded-md border border-stone-200 bg-[#f8f9fa]">
          <div ref={containerRef} className="h-full w-full" />
          {imageSrc && (
            <img
              src={imageSrc}
              alt={`Prévia do mapa de ${name}`}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </div>
        <p
          aria-live="polite"
          className={`max-w-md text-sm ${stage === "failed" ? "text-red-700" : "text-stone-700"}`}
        >
          {stageMessage(stage, requiresRepublish, failureReason)}
        </p>
      </div>
    </div>
  );
}
