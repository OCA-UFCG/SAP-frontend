import maplibregl from "maplibre-gl";
import { useCallback, type MutableRefObject } from "react";
import { STATES_SOURCE_ID, STATES_SOURCE_LAYER } from "./mapDefinitions";
import { BRAZIL_TERRITORY_CODE } from "./stateSelection";

interface UseStateFeatureSelectionArgs {
  debugEnabled: boolean;
  mapDebugIdRef: MutableRefObject<string>;
  mapRef: MutableRefObject<maplibregl.Map | null>;
  pendingSelectedSyncRef: MutableRefObject<boolean>;
  selectedStateRef: MutableRefObject<string>;
  selectedStateIdRef: MutableRefObject<string | number | null>;
}

export const useStateFeatureSelection = ({
  debugEnabled,
  mapDebugIdRef,
  mapRef,
  pendingSelectedSyncRef,
  selectedStateRef,
  selectedStateIdRef,
}: UseStateFeatureSelectionArgs) => {
  const log = useCallback(
    (...args: unknown[]) => {
      if (!debugEnabled) return;

      console.log(`[SAP Map ${mapDebugIdRef.current}]`, ...args);
    },
    [debugEnabled, mapDebugIdRef],
  );

  const warn = useCallback(
    (...args: unknown[]) => {
      if (!debugEnabled) return;

      console.warn(`[SAP Map ${mapDebugIdRef.current}]`, ...args);
    },
    [debugEnabled, mapDebugIdRef],
  );

  const safeGetFeatureState = useCallback(
    (map: maplibregl.Map, id: string | number) => {
      try {
        return map.getFeatureState({
          source: STATES_SOURCE_ID,
          sourceLayer: STATES_SOURCE_LAYER,
          id,
        });
      } catch {
        return null;
      }
    },
    [],
  );

  const applySelectedFeatureState = useCallback(
    (map: maplibregl.Map, next: string) => {
      const prev = selectedStateIdRef.current;

      log("applySelectedFeatureState", {
        prev,
        next,
        styleLoaded: map.isStyleLoaded(),
        hasStatesSource: Boolean(map.getSource(STATES_SOURCE_ID)),
      });

      if (prev && prev !== next) {
        try {
          map.setFeatureState(
            {
              source: STATES_SOURCE_ID,
              sourceLayer: STATES_SOURCE_LAYER,
              id: prev,
            },
            { selected: false, hover: false },
          );
          log("cleared prev selected", {
            prev,
            prevFeatureState: safeGetFeatureState(map, prev),
          });
          selectedStateIdRef.current = null;
        } catch (err) {
          warn("failed clearing prev selected", { prev, err });
          throw err;
        }
      }

      if (next && next !== BRAZIL_TERRITORY_CODE) {
        try {
          selectedStateIdRef.current = next;
          map.setFeatureState(
            {
              source: STATES_SOURCE_ID,
              sourceLayer: STATES_SOURCE_LAYER,
              id: next,
            },
            { selected: true },
          );
          log("set next selected", {
            next,
            nextFeatureState: safeGetFeatureState(map, next),
          });
        } catch (err) {
          warn("failed setting next selected", { next, err });
          throw err;
        }
      }
    },
    [log, safeGetFeatureState, selectedStateIdRef, warn],
  );

  const scheduleSelectedStateSync = useCallback(
    (reason: string) => {
      const map = mapRef.current;
      if (!map) return;
      if (pendingSelectedSyncRef.current) return;

      const currentMap = map;

      function registerStateSync(nextReason: string) {
        log("scheduleSelectedStateSync", {
          reason: nextReason,
          styleLoaded: currentMap.isStyleLoaded(),
          hasStatesSource: Boolean(currentMap.getSource(STATES_SOURCE_ID)),
          selectedStateRef: selectedStateRef.current,
          selectedStateIdRef: selectedStateIdRef.current,
        });

        pendingSelectedSyncRef.current = true;
        let didRun = false;

        const run = (trigger: "styledata" | "idle") => {
          if (didRun) return;
          didRun = true;

          pendingSelectedSyncRef.current = false;

          if (mapRef.current !== currentMap) return;

          const next = selectedStateRef.current;
          log("selectedStateSync fired", {
            trigger,
            reason: nextReason,
            next,
            styleLoaded: currentMap.isStyleLoaded(),
            hasStatesSource: Boolean(currentMap.getSource(STATES_SOURCE_ID)),
          });

          try {
            if (!currentMap.getSource(STATES_SOURCE_ID)) {
              registerStateSync("retry: states source missing");
              return;
            }

            applySelectedFeatureState(currentMap, next);
          } catch (err) {
            warn("selectedStateSync apply failed", {
              reason: nextReason,
              trigger,
              err,
            });
            registerStateSync("retry: setFeatureState threw");
          }
        };

        currentMap.once("styledata", () => run("styledata"));
        currentMap.once("idle", () => run("idle"));
      }

      registerStateSync(reason);
    },
    [
      applySelectedFeatureState,
      log,
      mapRef,
      pendingSelectedSyncRef,
      selectedStateIdRef,
      selectedStateRef,
      warn,
    ],
  );

  return {
    applySelectedFeatureState,
    log,
    scheduleSelectedStateSync,
    warn,
  };
};
