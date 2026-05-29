"use client";

import type {
  TelemetryEventInput,
  TelemetryIngestRequest,
} from "@/types/telemetry";

const LOGS_ENDPOINT = "/api/logs";
const SESSION_STORAGE_KEY = "sap.telemetry.sessionId";

function createAnonymousSessionId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getAnonymousSessionId() {
  try {
    const storedSessionId = window.localStorage.getItem(
      SESSION_STORAGE_KEY,
    );

    if (storedSessionId) {
      return storedSessionId;
    }

    const nextSessionId = createAnonymousSessionId();
    window.localStorage.setItem(SESSION_STORAGE_KEY, nextSessionId);
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
