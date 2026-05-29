import maplibregl, { LngLatBoundsLike } from "maplibre-gl";
import { useCallback, type MutableRefObject } from "react";
import {
  MAP_FOCUS_ANIMATION_DURATION,
  MAP_STATE_FOCUS_MAX_ZOOM,
  MUNICIPALITY_FOCUS_DELAY_MS,
  MUNICIPALITY_FOCUS_MAX_RETRIES,
  MUNICIPALITY_FOCUS_RETRY_INTERVAL_MS,
  MUNICIPALITY_STATE_FOCUS_DURATION,
  resolveMunicipalitySelectionBounds,
  smoothCameraEasing,
} from "./mapBounds";
import {
  MUNICIPALITY_SOURCE_ID,
  MUNICIPALITY_SOURCE_LAYER,
} from "./municipalityLayers";

interface UseMunicipalitySelectionArgs {
  mapRef: MutableRefObject<maplibregl.Map | null>;
  currentBoundsRef: MutableRefObject<LngLatBoundsLike | null>;
  selectedMunicipalityCodeRef: MutableRefObject<string | null>;
  selectedMunicipalityIdRef: MutableRefObject<string | number | null>;
  selectedMunicipalityBoundsRef: MutableRefObject<LngLatBoundsLike | null>;
  pendingSelectedMunicipalitySyncRef: MutableRefObject<boolean>;
  selectedMunicipalityRequestIdRef: MutableRefObject<number>;
  selectedMunicipalityFocusTimeoutRef: MutableRefObject<ReturnType<
    typeof setTimeout
  > | null>;
  onSelectedMunicipalityCodeChangeRef: MutableRefObject<
    ((municipalityCode: string | null) => void) | undefined
  >;
  fitMapToBounds: (
    map: maplibregl.Map,
    bounds: LngLatBoundsLike,
    options?: {
      animate?: boolean;
      duration?: number;
      easing?: (progress: number) => number;
      maxZoom?: number;
    },
  ) => void;
  fitSelectedMunicipalityToBounds: (
    map: maplibregl.Map,
    bounds: LngLatBoundsLike,
    options?: {
      animate?: boolean;
      duration?: number;
      easing?: (progress: number) => number;
    },
  ) => void;
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

export const useMunicipalitySelection = ({
  mapRef,
  currentBoundsRef,
  selectedMunicipalityCodeRef,
  selectedMunicipalityIdRef,
  selectedMunicipalityBoundsRef,
  pendingSelectedMunicipalitySyncRef,
  selectedMunicipalityRequestIdRef,
  selectedMunicipalityFocusTimeoutRef,
  onSelectedMunicipalityCodeChangeRef,
  fitMapToBounds,
  fitSelectedMunicipalityToBounds,
  log,
  warn,
}: UseMunicipalitySelectionArgs) => {
  const clearSelectedMunicipalityFocusTimeout = useCallback(() => {
    if (selectedMunicipalityFocusTimeoutRef.current === null) return;

    clearTimeout(selectedMunicipalityFocusTimeoutRef.current);
    selectedMunicipalityFocusTimeoutRef.current = null;
  }, [selectedMunicipalityFocusTimeoutRef]);

  const applySelectedMunicipalityFeatureState = useCallback(
    (map: maplibregl.Map, nextMunicipalityCode: string | null) => {
      const prev = selectedMunicipalityIdRef.current;

      log("applySelectedMunicipalityFeatureState", {
        prev,
        nextMunicipalityCode,
        styleLoaded: map.isStyleLoaded(),
        hasMunicipalitySource: Boolean(map.getSource(MUNICIPALITY_SOURCE_ID)),
      });

      if (prev && prev !== nextMunicipalityCode) {
        try {
          map.setFeatureState(
            {
              source: MUNICIPALITY_SOURCE_ID,
              sourceLayer: MUNICIPALITY_SOURCE_LAYER,
              id: prev,
            },
            { selected: false, hover: false },
          );
          selectedMunicipalityIdRef.current = null;
        } catch (err) {
          warn("failed clearing prev selected municipality", {
            prev,
            err,
          });
          throw err;
        }
      }

      if (nextMunicipalityCode) {
        try {
          selectedMunicipalityIdRef.current = nextMunicipalityCode;
          map.setFeatureState(
            {
              source: MUNICIPALITY_SOURCE_ID,
              sourceLayer: MUNICIPALITY_SOURCE_LAYER,
              id: nextMunicipalityCode,
            },
            { selected: true },
          );
        } catch (err) {
          warn("failed setting next selected municipality", {
            nextMunicipalityCode,
            err,
          });
          throw err;
        }
      }

      if (!nextMunicipalityCode) {
        selectedMunicipalityIdRef.current = null;
      }
    },
    [log, selectedMunicipalityIdRef, warn],
  );

  const clearSelectedMunicipalitySelection = useCallback(
    (map: maplibregl.Map) => {
      if (!selectedMunicipalityCodeRef.current) return;

      selectedMunicipalityCodeRef.current = null;
      selectedMunicipalityBoundsRef.current = null;
      selectedMunicipalityRequestIdRef.current += 1;
      pendingSelectedMunicipalitySyncRef.current = false;
      clearSelectedMunicipalityFocusTimeout();

      try {
        applySelectedMunicipalityFeatureState(map, null);
      } catch (err) {
        warn("failed clearing selected municipality", { err });
      }

      onSelectedMunicipalityCodeChangeRef.current?.(null);
    },
    [
      applySelectedMunicipalityFeatureState,
      clearSelectedMunicipalityFocusTimeout,
      onSelectedMunicipalityCodeChangeRef,
      pendingSelectedMunicipalitySyncRef,
      selectedMunicipalityBoundsRef,
      selectedMunicipalityCodeRef,
      selectedMunicipalityRequestIdRef,
      warn,
    ],
  );

  const scheduleSelectedMunicipalitySync = useCallback(
    (reason: string) => {
      const map = mapRef.current;
      if (!map) return;

      clearSelectedMunicipalityFocusTimeout();

      const requestId = ++selectedMunicipalityRequestIdRef.current;
      pendingSelectedMunicipalitySyncRef.current = true;

      const municipalityCode = selectedMunicipalityCodeRef.current;
      if (!municipalityCode) {
        selectedMunicipalityBoundsRef.current = null;
        pendingSelectedMunicipalitySyncRef.current = false;
        return;
      }

      let isFinished = false;
      let retryCount = 0;

      const finishSync = () => {
        isFinished = true;
        pendingSelectedMunicipalitySyncRef.current = false;
        clearSelectedMunicipalityFocusTimeout();
      };

      const scheduleRetry = () => {
        if (isFinished) return;
        if (selectedMunicipalityRequestIdRef.current !== requestId) {
          finishSync();
          return;
        }

        if (retryCount >= MUNICIPALITY_FOCUS_MAX_RETRIES) {
          finishSync();
          return;
        }

        retryCount += 1;
        selectedMunicipalityFocusTimeoutRef.current = setTimeout(() => {
          selectedMunicipalityFocusTimeoutRef.current = null;
          tryResolveAndFit("retry");
        }, MUNICIPALITY_FOCUS_RETRY_INTERVAL_MS);
      };

      const tryResolveAndFit = (trigger: "delayed" | "retry") => {
        if (isFinished) return;
        if (selectedMunicipalityRequestIdRef.current !== requestId) return;
        if (mapRef.current !== map) return;

        const nextMunicipalityCode = selectedMunicipalityCodeRef.current;
        if (!nextMunicipalityCode) {
          selectedMunicipalityBoundsRef.current = null;
          finishSync();
          return;
        }

        log("selectedMunicipalitySync fired", {
          trigger,
          reason,
          nextMunicipalityCode,
          styleLoaded: map.isStyleLoaded(),
          hasMunicipalitySource: Boolean(map.getSource(MUNICIPALITY_SOURCE_ID)),
        });

        if (!map.getSource(MUNICIPALITY_SOURCE_ID)) {
          scheduleRetry();
          return;
        }

        try {
          applySelectedMunicipalityFeatureState(map, nextMunicipalityCode);
        } catch (err) {
          warn("selectedMunicipalitySync pre-apply failed", {
            reason,
            trigger,
            err,
          });
        }

        const bounds = resolveMunicipalitySelectionBounds(
          map,
          nextMunicipalityCode,
        );

        if (!bounds) {
          scheduleRetry();
          return;
        }

        selectedMunicipalityBoundsRef.current = bounds;
        finishSync();

        try {
          fitSelectedMunicipalityToBounds(map, bounds, {
            animate: true,
            duration: MAP_FOCUS_ANIMATION_DURATION,
            easing: smoothCameraEasing,
          });
        } catch (err) {
          warn("selectedMunicipalitySync apply failed", {
            reason,
            trigger,
            err,
          });
        }
      };

      try {
        if (map.getSource(MUNICIPALITY_SOURCE_ID)) {
          applySelectedMunicipalityFeatureState(map, municipalityCode);
        }
      } catch (err) {
        warn("selectedMunicipalitySync pre-apply failed", {
          reason,
          trigger: "schedule",
          err,
        });
      }

      const delayMs =
        (currentBoundsRef.current ? MUNICIPALITY_STATE_FOCUS_DURATION : 0) +
        MUNICIPALITY_FOCUS_DELAY_MS;

      if (currentBoundsRef.current) {
        fitMapToBounds(map, currentBoundsRef.current, {
          animate: true,
          duration: MUNICIPALITY_STATE_FOCUS_DURATION,
          easing: smoothCameraEasing,
          maxZoom: MAP_STATE_FOCUS_MAX_ZOOM,
        });
      }

      selectedMunicipalityFocusTimeoutRef.current = setTimeout(() => {
        selectedMunicipalityFocusTimeoutRef.current = null;
        tryResolveAndFit("delayed");
      }, delayMs);
    },
    [
      applySelectedMunicipalityFeatureState,
      clearSelectedMunicipalityFocusTimeout,
      currentBoundsRef,
      fitMapToBounds,
      fitSelectedMunicipalityToBounds,
      log,
      mapRef,
      pendingSelectedMunicipalitySyncRef,
      selectedMunicipalityBoundsRef,
      selectedMunicipalityCodeRef,
      selectedMunicipalityFocusTimeoutRef,
      selectedMunicipalityRequestIdRef,
      warn,
    ],
  );

  return {
    clearSelectedMunicipalityFocusTimeout,
    clearSelectedMunicipalitySelection,
    scheduleSelectedMunicipalitySync,
  };
};
