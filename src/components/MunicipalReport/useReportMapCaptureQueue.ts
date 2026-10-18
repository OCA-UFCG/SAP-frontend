"use client";

import { useCallback, useMemo, useRef, useState } from "react";

export const REPORT_MAP_CAPTURE_CONCURRENCY = 5;
export const REPORT_MAP_CAPTURE_MAX_RETRIES = 1;

interface ReportMapCaptureQueue {
  activeMapKeys: ReadonlySet<string>;
  handleMapCapture: (key: string, src: string | null) => void;
  handleMapVisibility: (key: string, visible: boolean) => void;
  mapImages: Map<string, string | null>;
  mapsReady: boolean;
  pendingMapCount: number;
  resetMapCaptureQueue: () => void;
  retryAttemptFor: (key: string) => number;
  /** Devolve à fila um mapa que já desistiu, a pedido de quem lê. */
  retryMapCapture: (key: string) => void;
}

interface ReportMapPriorityOptions {
  /** Mapas cujo quadro está na área visível da tela. */
  visibleKeys?: ReadonlySet<string>;
}

/**
 * As vagas da fila de captura, na ordem em que devem ser preenchidas.
 *
 * O relatório tem vinte mapas e cinco vagas, então quatro ondas. Preencher as
 * vagas na ordem do documento faz quem está lendo a última seção esperar todas
 * as anteriores: medido em Juazeiro - BA, a espera na fila foi de 8450 ms de
 * mediana e 15 202 ms no pior mapa. Os mapas que estão na tela do leitor entram
 * antes, e os demais continuam vindo na ordem do documento.
 *
 * A prioridade é só a visibilidade, sem memória de quem já começou: se o leitor
 * rolar durante a montagem, um mapa em andamento pode perder a vaga e ser
 * refeito depois. É trabalho jogado fora num caso raro, e o preço de evitá-lo
 * seria guardar em estado quem já começou — informação que a seleção precisa ler
 * durante a renderização, o que o compilador do React não permite.
 *
 * @example
 * selectActiveReportMapKeys(keys, completed, null, 5, { visibleKeys });
 */
export function selectActiveReportMapKeys(
  mapKeys: readonly string[],
  completedKeys: ReadonlySet<string>,
  serialRetryKey: string | null,
  concurrency = REPORT_MAP_CAPTURE_CONCURRENCY,
  { visibleKeys }: ReportMapPriorityOptions = {},
) {
  if (serialRetryKey && !completedKeys.has(serialRetryKey)) {
    return [serialRetryKey];
  }

  const pending = mapKeys.filter((key) => !completedKeys.has(key));
  if (!visibleKeys?.size) {
    return pending.slice(0, concurrency);
  }

  return [
    ...pending.filter((key) => visibleKeys.has(key)),
    ...pending.filter((key) => !visibleKeys.has(key)),
  ].slice(0, concurrency);
}

export function useReportMapCaptureQueue(
  mapKeys: readonly string[],
): ReportMapCaptureQueue {
  const [mapImages, setMapImages] = useState<Map<string, string | null>>(
    new Map(),
  );
  const [retryAttempts, setRetryAttempts] = useState<Map<string, number>>(
    new Map(),
  );
  const retryAttemptsRef = useRef(retryAttempts);
  const [serialRetryKey, setSerialRetryKey] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const resetMapCaptureQueue = useCallback(() => {
    const nextRetryAttempts = new Map<string, number>();
    setMapImages(new Map());
    setRetryAttempts(nextRetryAttempts);
    retryAttemptsRef.current = nextRetryAttempts;
    setSerialRetryKey(null);
  }, []);

  const completedKeys = useMemo(() => new Set(mapImages.keys()), [mapImages]);
  const activeMapKeys = useMemo(
    () =>
      new Set(
        selectActiveReportMapKeys(
          mapKeys,
          completedKeys,
          serialRetryKey,
          REPORT_MAP_CAPTURE_CONCURRENCY,
          { visibleKeys },
        ),
      ),
    [completedKeys, mapKeys, serialRetryKey, visibleKeys],
  );
  const mapsReady = mapKeys.every((key) => completedKeys.has(key));
  const pendingMapCount = mapKeys.filter(
    (key) => !completedKeys.has(key),
  ).length;

  const handleMapVisibility = useCallback((key: string, visible: boolean) => {
    setVisibleKeys((current) => {
      if (current.has(key) === visible) return current;
      const next = new Set(current);
      if (visible) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const handleMapCapture = useCallback((key: string, src: string | null) => {
    if (!src) {
      const attempts = retryAttemptsRef.current.get(key) ?? 0;
      if (attempts < REPORT_MAP_CAPTURE_MAX_RETRIES) {
        const nextRetryAttempts = new Map(retryAttemptsRef.current);
        nextRetryAttempts.set(key, attempts + 1);
        retryAttemptsRef.current = nextRetryAttempts;
        setRetryAttempts(nextRetryAttempts);
        setSerialRetryKey(key);
        return;
      }
    }

    setMapImages((current) => {
      if (current.has(key)) return current;
      const next = new Map(current);
      next.set(key, src);
      return next;
    });
    setSerialRetryKey((current) => (current === key ? null : current));
  }, []);

  // A tentativa ganha número novo para o quadro esquecer a falha anterior e
  // montar o mapa de novo; como o orçamento automático já foi gasto, uma nova
  // falha vai direto para "indisponível" em vez de prender a fila em série.
  const retryMapCapture = useCallback((key: string) => {
    const nextRetryAttempts = new Map(retryAttemptsRef.current);
    nextRetryAttempts.set(
      key,
      Math.max(
        REPORT_MAP_CAPTURE_MAX_RETRIES,
        retryAttemptsRef.current.get(key) ?? 0,
      ) + 1,
    );
    retryAttemptsRef.current = nextRetryAttempts;
    setRetryAttempts(nextRetryAttempts);
    setMapImages((current) => {
      if (!current.has(key)) return current;
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  }, []);

  const retryAttemptFor = useCallback(
    (key: string) => retryAttempts.get(key) ?? 0,
    [retryAttempts],
  );

  return {
    activeMapKeys,
    handleMapCapture,
    handleMapVisibility,
    mapImages,
    mapsReady,
    pendingMapCount,
    resetMapCaptureQueue,
    retryAttemptFor,
    retryMapCapture,
  };
}
