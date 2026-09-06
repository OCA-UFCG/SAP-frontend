"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchReportMapURLs } from "@/services/mapServices";
import { startMunicipalReportStage } from "@/utils/municipalReportMetrics";
import {
  buildEeMapUrlKey,
  type EeMapUrlEntry,
  type EeMapUrlFailure,
  type EeMapUrlRequestItem,
} from "@/contracts/eeMapUrls";

/**
 * Quanto esperar antes de perguntar de novo pelas camadas que o servidor
 * marcou como `pending`. A ida ao Earth Engine segue em voo lá; perguntar de
 * novo só descobre se ela já terminou, e não custa vaga do limitador.
 */
export const REPORT_MAP_URLS_RETRY_DELAY_MS = 1500;
/** Teto de tentativas: 20 camadas frias levam cerca de 13 s no total. */
export const REPORT_MAP_URLS_MAX_ATTEMPTS = 20;

export interface ReportMapTileUrls {
  /** Verdadeiro quando toda camada já tem URL ou um motivo para não ter. */
  resolved: boolean;
  tileUrlFor: (key: string) => string | undefined;
  /** Por que a camada não trouxe URL, quando não trouxe. */
  failureFor: (key: string) => EeMapUrlFailure | undefined;
  unavailableKeys: ReadonlySet<string>;
}

interface ResolvedTileUrls {
  signature: string;
  tileUrls: ReadonlyMap<string, string>;
  failures: ReadonlyMap<string, EeMapUrlFailure>;
  pendingCount: number;
}

const EMPTY: ResolvedTileUrls = {
  signature: "",
  tileUrls: new Map(),
  failures: new Map(),
  pendingCount: 0,
};

/** `panelLayerId:periodo` — o período pode ter `-`, o id nunca tem `:`. */
function parseMapKey(key: string): EeMapUrlRequestItem {
  const separatorIndex = key.indexOf(":");
  return {
    name: key.slice(0, separatorIndex),
    year: key.slice(separatorIndex + 1),
  };
}

function delay(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function describeProgress(
  tileUrls: ReadonlyMap<string, string>,
  failures: ReadonlyMap<string, EeMapUrlFailure>,
  attempts: number,
) {
  const reasons = [...failures].map(([key, reason]) => `${key}: ${reason}`);
  const requests = `${attempts} requisição(ões)`;
  return reasons.length
    ? `${tileUrls.size} URL(s) em ${requests}; sem imagem: ${reasons.join(", ")}`
    : `${tileUrls.size} URL(s) em ${requests}`;
}

/**
 * Resolve num único pedido as URLs de tiles de todos os mapas do relatório, e
 * volta a perguntar só pelas que o Earth Engine ainda não entregou.
 *
 * Antes cada `ReportMapPreview` pedia a sua: 20 camadas viravam 20 requisições
 * ao `/api/ee`, as últimas voltavam 429 e o item saía com um quadro cinza sem
 * explicação. Resolver antes também evita construir um mapa MapLibre para uma
 * camada que não tem imagem naquele período, e deixa cada mapa começar assim
 * que a sua URL chega, em vez de esperar as vinte.
 *
 * @example
 * const { resolved, tileUrlFor } = useReportMapTileUrls(["anaseca:2024-12"]);
 */
export function useReportMapTileUrls(
  mapKeys: readonly string[],
): ReportMapTileUrls {
  const mapKeysSignature = mapKeys.join(",");
  const [state, setState] = useState<ResolvedTileUrls>(EMPTY);
  const measuredSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mapKeysSignature) return;
    const controller = new AbortController();
    const shouldMeasure = measuredSignatureRef.current !== mapKeysSignature;
    measuredSignatureRef.current = mapKeysSignature;

    void resolveTileUrls({
      signature: mapKeysSignature,
      signal: controller.signal,
      publish: setState,
      finishStage: shouldMeasure ? startMunicipalReportStage() : null,
    });

    return () => controller.abort();
  }, [mapKeysSignature]);

  const current = state.signature === mapKeysSignature ? state : EMPTY;

  return useMemo(
    () => ({
      resolved:
        !mapKeysSignature ||
        (current.signature === mapKeysSignature && current.pendingCount === 0),
      tileUrlFor: (key: string) => current.tileUrls.get(key),
      failureFor: (key: string) => current.failures.get(key),
      unavailableKeys: new Set(current.failures.keys()),
    }),
    [current, mapKeysSignature],
  );
}

interface ResolveTileUrlsOptions {
  signature: string;
  signal: AbortSignal;
  publish: (state: ResolvedTileUrls) => void;
  finishStage: ReturnType<typeof startMunicipalReportStage> | null;
}

/**
 * Pergunta pelas URLs e insiste apenas nas que voltaram `pending`, publicando o
 * que já chegou a cada resposta.
 */
async function resolveTileUrls({
  signature,
  signal,
  publish,
  finishStage,
}: ResolveTileUrlsOptions) {
  const tileUrls = new Map<string, string>();
  const failures = new Map<string, EeMapUrlFailure>();
  let waiting = signature.split(",").map(parseMapKey);
  let attempts = 0;

  while (waiting.length > 0 && attempts < REPORT_MAP_URLS_MAX_ATTEMPTS) {
    if (attempts > 0) await delay(REPORT_MAP_URLS_RETRY_DELAY_MS, signal);
    if (signal.aborted) return;

    attempts += 1;
    const entries = await requestTileUrls(waiting, signal);
    if (signal.aborted) return;

    waiting = collectEntries(entries, tileUrls, failures);
    publish({
      signature,
      tileUrls: new Map(tileUrls),
      failures: new Map(failures),
      pendingCount: waiting.length,
    });
  }

  // O que nunca chegou vira indisponível: o relatório precisa poder terminar.
  for (const item of waiting) {
    failures.set(buildEeMapUrlKey(item.name, item.year), "error");
  }
  publish({
    signature,
    tileUrls: new Map(tileUrls),
    failures: new Map(failures),
    pendingCount: 0,
  });
  finishStage?.("URLs dos mapas no Earth Engine", {
    detalhes: describeProgress(tileUrls, failures, attempts),
  });
}

async function requestTileUrls(
  items: readonly EeMapUrlRequestItem[],
  signal: AbortSignal,
): Promise<EeMapUrlEntry[]> {
  try {
    return await fetchReportMapURLs(items, signal);
  } catch (reason) {
    if (signal.aborted) return [];
    console.error(
      `[municipalReport] falha ao resolver as URLs dos mapas: ${items.length} camada(s)`,
      reason,
    );
    return items.map((item) => ({ ...item, status: "error" as const }));
  }
}

/** Guarda o que chegou e devolve o que ainda falta perguntar. */
function collectEntries(
  entries: readonly EeMapUrlEntry[],
  tileUrls: Map<string, string>,
  failures: Map<string, EeMapUrlFailure>,
): EeMapUrlRequestItem[] {
  const stillWaiting: EeMapUrlRequestItem[] = [];

  for (const entry of entries) {
    const key = buildEeMapUrlKey(entry.name, entry.year);
    if (entry.url) tileUrls.set(key, entry.url);
    else if (entry.status === "pending")
      stillWaiting.push({ name: entry.name, year: entry.year });
    else failures.set(key, entry.status ?? "error");
  }

  return stillWaiting;
}
