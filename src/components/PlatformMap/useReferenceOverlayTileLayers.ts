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

interface CachedTileUrl {
  url: string;
  fetchedAt: number;
}

// A URL de tiles do GEE não vale para sempre. O servidor descarta a dele depois
// de 30 min (CACHE_TTL_MS em src/app/api/ee/cache.ts) justamente porque o mapid
// expira. O cache do cliente precisa vencer ANTES disso: caso contrário uma aba
// aberta por horas continua pedindo tiles de uma URL que o servidor já
// abandonou, e a camada some do mapa sem nenhum erro visível.
const CLIENT_URL_CACHE_TTL_MS = 1000 * 60 * 25;

const clientUrlCache = new Map<ReferenceLayerId, CachedTileUrl>();

const EMPTY_SET = new Set<ReferenceLayerId>();

/** Somente para testes: o cache vive no módulo e precisa ser zerado entre casos. */
export function clearReferenceOverlayUrlCache() {
  clientUrlCache.clear();
}

function readFreshCachedUrl(layerId: ReferenceLayerId): string | undefined {
  const cached = clientUrlCache.get(layerId);
  if (!cached) return undefined;

  if (Date.now() - cached.fetchedAt > CLIENT_URL_CACHE_TTL_MS) {
    clientUrlCache.delete(layerId);
    return undefined;
  }

  return cached.url;
}

async function fetchReferenceLayerUrl(
  layerId: ReferenceLayerId,
  signal?: AbortSignal,
): Promise<string | null> {
  const params = new URLSearchParams({ layer: layerId });
  const response = await fetch(
    `${API_BASE_URL}/api/ee/reference-layers?${params.toString()}`,
    { method: "POST", signal, credentials: "include" },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      (body as { error?: string })?.error ??
        `Failed to fetch reference layer "${layerId}": HTTP ${response.status}`,
    );
  }

  const body = (await response.json()) as { url?: string };
  return typeof body.url === "string" ? body.url : null;
}

/**
 * Devolve a URL de tiles da camada, do cache do cliente quando ainda está
 * dentro da validade e da API quando não está.
 */
async function resolveReferenceLayerTileUrl(
  layerId: ReferenceLayerId,
  signal: AbortSignal,
): Promise<string | null> {
  const cachedUrl = readFreshCachedUrl(layerId);
  if (cachedUrl) return cachedUrl;

  const url = await fetchReferenceLayerUrl(layerId, signal);
  if (url) clientUrlCache.set(layerId, { url, fetchedAt: Date.now() });
  return url;
}

function withEntry(
  current: ReferenceOverlayTileMap,
  layerId: ReferenceLayerId,
  entry: ReferenceOverlayEntry,
): ReferenceOverlayTileMap {
  const previous = current.get(layerId);
  if (previous?.status === entry.status && previous.tileUrl === entry.tileUrl) {
    return current;
  }

  const next = new Map(current);
  next.set(layerId, entry);
  return next;
}

function serializeOverlaySet(overlays: Set<ReferenceLayerId>): string {
  return Array.from(overlays).sort().join(",");
}

function parseOverlayKey(overlaysKey: string): ReferenceLayerId[] {
  return overlaysKey ? (overlaysKey.split(",") as ReferenceLayerId[]) : [];
}

/**
 * Resolve a URL de tiles de cada camada de referência ativa.
 *
 * Retorna um Map estável por `ReferenceLayerId`; camadas desmarcadas somem do
 * resultado e têm a requisição em voo abortada na hora.
 *
 * const tiles = useReferenceOverlayTileLayers(referenceOverlays);
 */
export function useReferenceOverlayTileLayers(
  activeOverlays?: Set<ReferenceLayerId> | null,
): ReferenceOverlayTileMap {
  const overlaysKey = serializeOverlaySet(
    activeOverlays instanceof Set ? activeOverlays : EMPTY_SET,
  );
  const [statusMap, setStatusMap] = useState<ReferenceOverlayTileMap>(
    () => new Map(),
  );
  const controllersRef = useRef(
    new globalThis.Map<ReferenceLayerId, AbortController>(),
  );

  useEffect(() => {
    const controllers = controllersRef.current;
    const activeIds = parseOverlayKey(overlaysKey);
    const activeIdSet = new Set(activeIds);

    for (const [layerId, controller] of controllers) {
      if (activeIdSet.has(layerId)) continue;
      controller.abort();
      controllers.delete(layerId);
    }

    for (const layerId of activeIds) {
      if (controllers.has(layerId)) continue;

      const controller = new AbortController();
      controllers.set(layerId, controller);

      resolveReferenceLayerTileUrl(layerId, controller.signal)
        .then((url) => {
          if (controller.signal.aborted) return;
          setStatusMap((current) =>
            withEntry(current, layerId, {
              status: url ? "ready" : "error",
              tileUrl: url ?? undefined,
            }),
          );
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          console.error(
            `[referenceOverlay] falha ao resolver a URL de tiles: ${layerId}`,
            error,
          );
          setStatusMap((current) =>
            withEntry(current, layerId, {
              status: "error",
              tileUrl: undefined,
            }),
          );
        })
        .finally(() => {
          // Sem esta liberação o controller já resolvido continua no mapa, e o
          // guard de "requisição em voo" acima bloqueia para sempre qualquer
          // nova tentativa dessa camada.
          if (controllers.get(layerId) === controller) {
            controllers.delete(layerId);
          }
        });
    }
  }, [overlaysKey]);

  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
    };
  }, []);

  return useMemo(() => {
    const tileMap: ReferenceOverlayTileMap = new Map();
    for (const layerId of parseOverlayKey(overlaysKey)) {
      tileMap.set(
        layerId,
        statusMap.get(layerId) ?? { status: "loading", tileUrl: undefined },
      );
    }
    return tileMap;
  }, [overlaysKey, statusMap]);
}

export interface ReferenceOverlayTiles {
  tileUrls: globalThis.Map<string, string | undefined>;
  isLoading: boolean;
}

export function useReferenceOverlayTiles(
  activeOverlays?: Set<ReferenceLayerId> | null,
): ReferenceOverlayTiles {
  const tileMap = useReferenceOverlayTileLayers(activeOverlays);

  return useMemo(() => {
    const tileUrls = new globalThis.Map<string, string | undefined>();
    let isLoading = false;

    for (const [layerId, entry] of tileMap) {
      if (entry.status === "ready" && entry.tileUrl) {
        tileUrls.set(layerId, entry.tileUrl);
      } else if (entry.status === "loading") {
        isLoading = true;
      }
    }

    return { tileUrls, isLoading };
  }, [tileMap]);
}
