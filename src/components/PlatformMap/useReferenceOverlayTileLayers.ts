"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReferenceLayerId } from "@/components/MapLayerContext/mapLayerState";

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_URL ?? "";

export type ReferenceOverlayStatus = "loading" | "ready" | "error";

export interface ReferenceOverlayEntry {
  status: ReferenceOverlayStatus;
  tileUrl: string | undefined;
}

export type ReferenceOverlayTileMap = Map<
  ReferenceLayerId,
  ReferenceOverlayEntry
>;

async function fetchReferenceLayerUrl(
  layerId: ReferenceLayerId,
  signal?: AbortSignal,
): Promise<string | null> {
  const params = new URLSearchParams({ layer: layerId });
  const response = await fetch(
    `${API_BASE_URL}/api/ee/reference-layers?${params.toString()}`,
    {
      method: "POST",
      signal,
      credentials: "include",
    },
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(
      (data as { error?: string })?.error ?? "Failed to fetch reference layer",
    );
  }

  const data = (await response.json()) as { url?: string };
  return typeof data.url === "string" ? data.url : null;
}

// Client-side session cache for resolved tile URLs.
// Prevents duplicate POST /api/ee/reference-layers requests and rate-limit consumption
// when checking/unchecking the same reference layer multiple times.
const clientUrlCache = new Map<ReferenceLayerId, string>();

const EMPTY_SET = new Set<ReferenceLayerId>();

/**
 * For each active reference overlay, fetches the GEE tile URL.
 * Returns a stable Map keyed by ReferenceLayerId.
 *
 * Uses a ref-based controller map so that deactivation aborts in-flight
 * requests synchronously during the effect, preventing race conditions where
 * a .then() microtask resurrects a removed entry between state changes.
 */
export function useReferenceOverlayTileLayers(
  activeOverlays?: Set<ReferenceLayerId> | null,
): ReferenceOverlayTileMap {
  const overlays = activeOverlays instanceof Set ? activeOverlays : EMPTY_SET;

  // Stores status/error entries for active layers
  const [statusMap, setStatusMap] = useState<
    Map<ReferenceLayerId, ReferenceOverlayEntry>
  >(() => new Map());

  // Persistent controller map — lives across effect invocations so we can
  // abort a specific layer's request the moment it leaves the active set.
  const controllersRef = useRef(
    new (globalThis.Map)<ReferenceLayerId, AbortController>(),
  );

  useEffect(() => {
    const controllers = controllersRef.current;

    // 1. Abort and remove controllers for overlays no longer active.
    for (const [layerId, controller] of controllers) {
      if (!overlays.has(layerId)) {
        controller.abort();
        controllers.delete(layerId);
      }
    }

    // 2. Start fetches for newly-activated overlays that aren't cached or fetching.
    for (const layerId of overlays) {
      if (controllers.has(layerId) || clientUrlCache.has(layerId)) continue;

      const controller = new AbortController();
      controllers.set(layerId, controller);

      fetchReferenceLayerUrl(layerId, controller.signal)
        .then((url) => {
          if (controller.signal.aborted) return;

          if (url) {
            clientUrlCache.set(layerId, url);
          }

          setStatusMap((current) => {
            const next = new Map(current);
            next.set(layerId, {
              status: url ? "ready" : "error",
              tileUrl: url ?? undefined,
            });
            return next;
          });
        })
        .catch((err) => {
          if (controller.signal.aborted) return;

          console.error(`Error fetching reference layer "${layerId}":`, err);
          setStatusMap((current) => {
            const next = new Map(current);
            next.set(layerId, { status: "error", tileUrl: undefined });
            return next;
          });
        });
    }

    // No per-invocation cleanup — controllers are managed explicitly above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializeOverlaySet(overlays)]);

  // Cleanup on unmount: abort all in-flight requests.
  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      for (const controller of controllers.values()) {
        controller.abort();
      }
      controllers.clear();
    };
  }, []);

  // Compute the active tileMap dynamically from overlays, clientUrlCache, and statusMap.
  return useMemo(() => {
    const map: ReferenceOverlayTileMap = new Map();
    for (const layerId of overlays) {
      const cachedUrl = clientUrlCache.get(layerId);
      if (cachedUrl) {
        map.set(layerId, { status: "ready", tileUrl: cachedUrl });
      } else {
        const entry = statusMap.get(layerId);
        map.set(layerId, entry ?? { status: "loading", tileUrl: undefined });
      }
    }
    return map;
  }, [overlays, statusMap]);
}

function serializeOverlaySet(set?: Set<ReferenceLayerId> | null): string {
  if (!set || !(set instanceof Set)) return "";
  return Array.from(set).sort().join(",");
}
