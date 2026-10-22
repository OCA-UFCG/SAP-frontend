"use client";

import type {
  TelemetryEventInput,
  TelemetryIngestRequest,
} from "@/types/telemetry";

const LOGS_ENDPOINT = "/api/logs";
const SESSION_STORAGE_KEY = "sedes.telemetry.sessionId";

function createAnonymousSessionId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Um id por aba, que some quando ela fecha. Ele existe para agrupar os eventos
 * de uma mesma visita; guardado no `localStorage`, como era antes, ele
 * sobrevivia para sempre e virava um rastreador fixo daquele navegador.
 */
function getAnonymousSessionId() {
  try {
    // Apaga o id permanente que versões anteriores deixaram no navegador.
    window.localStorage.removeItem(SESSION_STORAGE_KEY);

    const storedSessionId = window.sessionStorage.getItem(SESSION_STORAGE_KEY);

    if (storedSessionId) {
      return storedSessionId;
    }

    const nextSessionId = createAnonymousSessionId();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, nextSessionId);
    return nextSessionId;
  } catch {
    return createAnonymousSessionId();
  }
}

function dispatchTelemetry(payload: TelemetryIngestRequest) {
  const body = JSON.stringify(payload);

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.sendBeacon === "function"
  ) {
    const blob = new Blob([body], { type: "application/json" });

    if (navigator.sendBeacon(LOGS_ENDPOINT, blob)) {
      return;
    }
  }

  void fetch(LOGS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
}

export function trackUiEvents(events: TelemetryEventInput[]) {
  if (typeof window === "undefined" || events.length === 0) {
    return;
  }

  const occurredAt = new Date().toISOString();
  const anonymousSessionId = getAnonymousSessionId();

  dispatchTelemetry({
    events: events.map((event) => ({
      ...event,
      occurredAt: event.occurredAt ?? occurredAt,
      anonymousSessionId: event.anonymousSessionId ?? anonymousSessionId,
    })),
  });
}

export function trackUiEvent(event: TelemetryEventInput) {
  trackUiEvents([event]);
}
