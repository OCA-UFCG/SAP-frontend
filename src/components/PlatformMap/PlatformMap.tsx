"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PlatformMapCaption } from "@/components/PlatformMapCaption/PlatformMapCaption";
import { useEarthEngineTileLayer } from "./useEarthEngineTileLayer";
import { useReferenceOverlayTileLayers } from "./useReferenceOverlayTileLayers";
import { useSpatialBoundaryOverlay } from "./useSpatialBoundaryOverlay";
import MapComponent from "../Map/MapComponent";
import type { BasemapId } from "../Map/Map";
import { geoBrasilSource, resolveSpatialFocusBounds } from "../Map/mapBounds";
import {
  useMapLayerActions,
  useMapLayerActiveState,
  useMapLayerViewState,
} from "@/components/MapLayerContext/MapLayerContext";
import {
  REFERENCE_LAYER_IDS,
  type ReferenceLayerId,
} from "@/components/MapLayerContext/mapLayerState";

interface PlatformMapProps {
  showMonitoringOverlays?: boolean;
}

import { getAllowedStateUfs } from "@/utils/interestAreaStates";

export function PlatformMap({ showMonitoringOverlays = true }: PlatformMapProps) {
  const t = useTranslations("PlatformMap");
  const { activeData, activeEEData } = useMapLayerActiveState();
  const {
    activeLegend,
    selectedState,
    selectedMunicipalityCode,
    activeYear,
    layerOpacity,
    spatialSelection,
    referenceOverlays,
  } = useMapLayerViewState();
  const { setSelectedState, setSelectedMunicipalityCode, setLayerOpacity, toggleReferenceOverlay } =
    useMapLayerActions();
  const { requestKey, status, tileLayerUrl } = useEarthEngineTileLayer(
    activeEEData,
    activeYear,
    spatialSelection,
  );
  const [readyRequestKey, setReadyRequestKey] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<BasemapId>("osm");
  const [isReferenceOverlaysOpen, setIsReferenceOverlaysOpen] = useState(false);

  const referenceOverlayTileMap = useReferenceOverlayTileLayers(referenceOverlays);

  // Derive a primitive string key of active ready tile URLs to preserve referential equality
  // without accessing or mutating React refs during render.
  const activeOverlayUrlsKey = useMemo(() => {
    const parts: string[] = [];
    for (const [layerId, entry] of referenceOverlayTileMap) {
      if (
        referenceOverlays?.has?.(layerId) &&
        entry.status === "ready" &&
        entry.tileUrl
      ) {
        parts.push(`${layerId}:::${entry.tileUrl}`);
      }
    }
    return parts.sort().join("|");
  }, [referenceOverlayTileMap, referenceOverlays]);

  const referenceOverlayTileUrls = useMemo(() => {
    const urls = new Map<string, string | undefined>();
    if (!activeOverlayUrlsKey) return urls;
    for (const part of activeOverlayUrlsKey.split("|")) {
      const idx = part.indexOf(":::");
      if (idx !== -1) {
        const layerId = part.slice(0, idx);
        const tileUrl = part.slice(idx + 3);
        if (layerId && tileUrl) {
          urls.set(layerId, tileUrl);
        }
      }
    }
    return urls;
  }, [activeOverlayUrlsKey]);

  const handleTileLayerReady = useCallback((readyRequestKey: string) => {
    setReadyRequestKey((current) =>
      current === readyRequestKey ? current : readyRequestKey,
    );
  }, []);

  const allowedStateUfs = useMemo(
    () => getAllowedStateUfs(spatialSelection),
    [spatialSelection],
  );

  const { boundaryGeoJson, status: boundaryStatus } =
    useSpatialBoundaryOverlay(spatialSelection);

  const spatialFocusBounds = useMemo(() => {
    // Enquanto o contorno exato está em voo, não enquadrar pela união dos
    // estados: renderizaria um movimento grosseiro seguido de outro correto.
    if (boundaryStatus === "loading") return null;

    return resolveSpatialFocusBounds(
      geoBrasilSource,
      allowedStateUfs,
      boundaryGeoJson,
    );
  }, [allowedStateUfs, boundaryGeoJson, boundaryStatus]);

  const hasRenderedCurrentRequest =
    status === "ready" && Boolean(requestKey) && readyRequestKey === requestKey;

  const isGeeLayerLoading =
    Boolean(activeEEData) &&
    (status === "loading" ||
      (status === "ready" && !hasRenderedCurrentRequest));

  // Check if any reference overlay is currently loading
  const isAnyReferenceOverlayLoading = useMemo(() => {
    for (const entry of referenceOverlayTileMap.values()) {
      if (entry.status === "loading") return true;
    }
    return false;
  }, [referenceOverlayTileMap]);

  return (
    <div className="absolute inset-0">
      <div className="relative flex w-full h-full z-10">
        <MapComponent
          mapMode="platform"
          minZoom={3}
          center={[-15.749997, -47.9499962]}
          zoom={4}
          showStatesBorder
          dadosCDI={activeData ?? undefined}
          estadoSelecionado={selectedState.toUpperCase()}
          selectedMunicipalityCode={selectedMunicipalityCode}
          className="w-full h-full"
          tileLayerUrl={tileLayerUrl}
          tileLayerRequestKey={requestKey}
          layerOpacity={layerOpacity}
          allowedStateUfs={allowedStateUfs}
          spatialBoundaryGeoJson={boundaryGeoJson}
          spatialFocusBounds={spatialFocusBounds}
          basemap={basemap}
          referenceOverlayTileUrls={referenceOverlayTileUrls}
          onStateSelect={(uf: string) => setSelectedState(uf.toLowerCase())}
          onSelectedMunicipalityCodeChange={setSelectedMunicipalityCode}
          onTileLayerReady={handleTileLayerReady}
        />

        {(isGeeLayerLoading || isAnyReferenceOverlayLoading) && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6">
            <div
              aria-live="polite"
              aria-label={t("loadingGeeLayer")}
              className="flex items-center gap-3 rounded-full border border-white/25 bg-stone-950/78 px-5 py-3 text-sm font-medium text-white shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm"
              role="status"
            >
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
              />
              <span>{t("loadingMapLayer")}</span>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 right-6 z-[1000] box-border flex min-h-[124px] w-[302px] flex-col items-end justify-center gap-[10px] pb-6">
        {showMonitoringOverlays && (
          <div
            className="box-border flex w-[302px] shrink-0 flex-col gap-2.5 self-stretch rounded-lg border border-[#EFEFEF] bg-white px-4 py-3"
            role="group"
            aria-label={t("referenceOverlays")}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between outline-none"
              onClick={() => setIsReferenceOverlaysOpen(!isReferenceOverlaysOpen)}
              aria-expanded={isReferenceOverlaysOpen}
            >
              <span className="font-open-sans text-[10px] font-semibold leading-[18px] tracking-[-0.006em] text-[#292829]">
                {t("referenceOverlays")}
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`transition-transform duration-200 ${isReferenceOverlaysOpen ? "rotate-180" : ""}`}
              >
                <path
                  d="M4 10L8 6L12 10"
                  stroke="#292829"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {isReferenceOverlaysOpen && (
              <div className="flex flex-col gap-1.5 mt-1">
                {REFERENCE_LAYER_IDS.map((layerId) => (
                  <label
                    key={layerId}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={referenceOverlays.has(layerId)}
                      onChange={() => toggleReferenceOverlay(layerId)}
                      className="h-3.5 w-3.5 shrink-0 cursor-pointer appearance-none rounded-[3px] border border-[#C4C4C4] bg-white transition-colors checked:border-[#989F43] checked:bg-[#989F43] relative
                        after:content-[''] after:absolute after:inset-0 after:flex after:items-center after:justify-center
                        checked:after:content-['✓'] after:text-[9px] after:font-bold after:text-white after:leading-none after:text-center"
                    />
                    <span className="font-open-sans text-[10px] font-normal leading-[16px] text-[#292829] select-none">
                      {t(layerId as ReferenceLayerId)}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        {showMonitoringOverlays && (
          <div
            className="box-border flex h-[50px] w-[302px] shrink-0 items-center gap-2 self-stretch rounded-lg border border-[#EFEFEF] bg-white p-4"
            role="group"
            aria-label={t("basemap")}
          >
            <span className="h-[18px] w-[66px] shrink-0 font-open-sans text-[10px] font-normal leading-[18px] tracking-[-0.006em] text-[#292829]">
              {t("basemap")}
            </span>
            <div className="flex h-7 min-w-0 flex-1 rounded-md bg-[#F1F5F9] p-0.5">
              <button
                type="button"
                onClick={() => setBasemap("osm")}
                aria-pressed={basemap === "osm"}
                className={`flex min-w-0 flex-1 items-center justify-center rounded-[4px] px-2 font-open-sans text-[10px] font-medium leading-[18px] transition-colors ${
                  basemap === "osm"
                    ? "bg-[#989F43] text-white shadow-sm"
                    : "text-[#292829] hover:bg-[#E4E5E2]"
                }`}
              >
                {t("street")}
              </button>
              <button
                type="button"
                onClick={() => setBasemap("satellite")}
                aria-pressed={basemap === "satellite"}
                className={`flex min-w-0 flex-1 items-center justify-center rounded-[4px] px-2 font-open-sans text-[10px] font-medium leading-[18px] transition-colors ${
                  basemap === "satellite"
                    ? "bg-[#989F43] text-white shadow-sm"
                    : "text-[#292829] hover:bg-[#E4E5E2]"
                }`}
              >
                {t("satellite")}
              </button>
            </div>
          </div>
        )}
        {showMonitoringOverlays && activeEEData && (
          <div className="box-border flex h-[50px] w-[302px] shrink-0 flex-col items-center gap-2 self-stretch rounded-lg border border-[#EFEFEF] bg-white p-4">
            <div className="flex h-[18px] w-[270px] shrink-0 items-center justify-center gap-2">
              <span className="h-[18px] w-[66px] shrink-0 font-open-sans text-[10px] font-normal leading-[18px] tracking-[-0.006em] text-[#292829]">
                {t("opacity")}
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={layerOpacity ?? 0.85}
                aria-label={t("opacity")}
                onChange={(e) => setLayerOpacity(parseFloat(e.target.value))}
                className="h-2 w-[168px] shrink-0 cursor-pointer appearance-none rounded-[40px] bg-[#F1F5F9] [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#989F43] [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-[40px] [&::-moz-range-track]:bg-[#F1F5F9] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#989F43] [&::-webkit-slider-thumb]:bg-white"
              />
              <span className="h-[18px] w-5 shrink-0 font-open-sans text-[10px] font-normal leading-[18px] tracking-[-0.006em] text-[#292829]">
                {Math.round((layerOpacity ?? 0.85) * 100)}%
              </span>
            </div>
          </div>
        )}

        {showMonitoringOverlays && activeLegend && activeLegend.length > 0 && (
          <PlatformMapCaption legend={activeLegend} />
        )}
      </div>
    </div>
  );
}
