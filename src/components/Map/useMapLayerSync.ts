import maplibregl, { GeoJSONSource } from "maplibre-gl";
import { useCallback, type MutableRefObject } from "react";
import {
  CDI_LAYER_ID,
  CDI_SOURCE_ID,
  GEE_LAYER_ID,
  GEE_SOURCE_ID,
  type MapMode,
  STATES_BORDER_LAYER_ID,
  STATES_FILL_LAYER_ID,
  STATES_SOURCE_ID,
  ensureMapLayers,
} from "./mapDefinitions";
import { buildCdiGeoJson } from "./mapBounds";

interface UseMapLayerSyncArgs {
  mapRef: MutableRefObject<maplibregl.Map | null>;
  mapModeRef: MutableRefObject<MapMode>;
  showStatesBorderRef: MutableRefObject<boolean>;
  hasCdiDataRef: MutableRefObject<boolean>;
  cdiGeoJsonRef: MutableRefObject<ReturnType<typeof buildCdiGeoJson>>;
  tileLayerUrlRef: MutableRefObject<string | null | undefined>;
  pendingStyleSyncRef: MutableRefObject<boolean>;
  selectedStateRef: MutableRefObject<string>;
  selectedMunicipalityCodeRef: MutableRefObject<string | null>;
  applySelectedFeatureState: (map: maplibregl.Map, next: string) => void;
  scheduleSelectedStateSync: (reason: string) => void;
  scheduleSelectedMunicipalitySync: (reason: string) => void;
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

export const useMapLayerSync = ({
  mapRef,
  mapModeRef,
  showStatesBorderRef,
  hasCdiDataRef,
  cdiGeoJsonRef,
  tileLayerUrlRef,
  pendingStyleSyncRef,
  selectedStateRef,
  selectedMunicipalityCodeRef,
  applySelectedFeatureState,
  scheduleSelectedStateSync,
  scheduleSelectedMunicipalitySync,
  log,
  warn,
}: UseMapLayerSyncArgs) => {
  return useCallback(
    function syncMapLayersImpl() {
      const map = mapRef.current;
      if (!map) return;

      if (!tileLayerUrlRef.current) {
        try {
          if (map.getLayer(GEE_LAYER_ID)) map.removeLayer(GEE_LAYER_ID);
          if (map.getSource(GEE_SOURCE_ID)) map.removeSource(GEE_SOURCE_ID);
        } catch {
          // Best-effort cleanup; if style isn't ready, we'll retry below.
        }
      }

      if (!map.isStyleLoaded()) {
        if (pendingStyleSyncRef.current) return;
        pendingStyleSyncRef.current = true;

        let didRetry = false;
        const retry = (trigger: "styledata" | "idle") => {
          if (didRetry) return;
          didRetry = true;
          pendingStyleSyncRef.current = false;
          log("syncMapLayers retry", { trigger });
          syncMapLayersImpl();
        };

        map.once("styledata", () => retry("styledata"));
        map.once("idle", () => retry("idle"));
        return;
      }

      log("syncMapLayers", {
        styleLoaded: map.isStyleLoaded(),
        hasStatesSource: Boolean(map.getSource(STATES_SOURCE_ID)),
        tileLayerUrl: tileLayerUrlRef.current,
        showStatesBorder: showStatesBorderRef.current,
        hasCdiData: hasCdiDataRef.current,
      });

      ensureMapLayers(
        map,
        mapModeRef.current,
        showStatesBorderRef.current,
        hasCdiDataRef.current,
        tileLayerUrlRef.current,
      );

      if (mapModeRef.current === "platform") {
        try {
          if (map.getSource(STATES_SOURCE_ID)) {
            applySelectedFeatureState(map, selectedStateRef.current);
          }
        } catch (err) {
          warn("syncMapLayers applySelectedFeatureState failed", { err });
          scheduleSelectedStateSync("syncMapLayers");
        }

        if (selectedMunicipalityCodeRef.current) {
          scheduleSelectedMunicipalitySync("syncMapLayers");
        }
      }

      const cdiSource = map.getSource(CDI_SOURCE_ID) as
        | GeoJSONSource
        | undefined;
      cdiSource?.setData(cdiGeoJsonRef.current);

      if (mapModeRef.current === "platform") {
        map.setLayoutProperty(STATES_FILL_LAYER_ID, "visibility", "visible");
        map.setLayoutProperty(
          STATES_BORDER_LAYER_ID,
          "visibility",
          showStatesBorderRef.current ? "visible" : "none",
        );
      }

      map.setLayoutProperty(
        CDI_LAYER_ID,
        "visibility",
        hasCdiDataRef.current ? "visible" : "none",
      );
    },
    [
      applySelectedFeatureState,
      cdiGeoJsonRef,
      hasCdiDataRef,
      log,
      mapModeRef,
      mapRef,
      pendingStyleSyncRef,
      scheduleSelectedMunicipalitySync,
      scheduleSelectedStateSync,
      selectedMunicipalityCodeRef,
      selectedStateRef,
      showStatesBorderRef,
      tileLayerUrlRef,
      warn,
    ],
  );
};
