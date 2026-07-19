"use client";

import { useCallback, useMemo, useRef, useState } from "react";

export const REPORT_MAP_CAPTURE_CONCURRENCY = 5;
export const REPORT_MAP_CAPTURE_MAX_RETRIES = 1;

interface ReportMapCaptureQueue {
  activeMapKeys: ReadonlySet<string>;
  handleMapCapture: (key: string, src: string | null) => void;
  mapImages: Map<string, string | null>;
  mapsReady: boolean;
  resetMapCaptureQueue: () => void;
  retryAttemptFor: (key: string) => number;
}

export function selectActiveReportMapKeys(
  mapKeys: readonly string[],
  completedKeys: ReadonlySet<string>,
  serialRetryKey: string | null,
  concurrency = REPORT_MAP_CAPTURE_CONCURRENCY,
) {
  if (serialRetryKey && !completedKeys.has(serialRetryKey)) {
    return [serialRetryKey];
  }

  return mapKeys.filter((key) => !completedKeys.has(key)).slice(0, concurrency);
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
        selectActiveReportMapKeys(mapKeys, completedKeys, serialRetryKey),
      ),
    [completedKeys, mapKeys, serialRetryKey],
  );
  const mapsReady = mapKeys.every((key) => completedKeys.has(key));

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

  const retryAttemptFor = useCallback(
    (key: string) => retryAttempts.get(key) ?? 0,
    [retryAttempts],
  );

  return {
    activeMapKeys,
    handleMapCapture,
    mapImages,
    mapsReady,
    resetMapCaptureQueue,
    retryAttemptFor,
  };
}
