import {
  getRecentTelemetryEvents,
  saveTelemetryEvents,
} from "@/repositories/telemetry/telemetryRepository";
import {
  buildPersistedTelemetryEvent,
  parseTelemetryIngestRequest,
  type PersistedTelemetryEvent,
  type TelemetryCountEntry,
  type TelemetryDashboardData,
} from "@/types/telemetry";

interface IngestTelemetryEventsOptions {
  uid?: string | null;
  now?: Date;
}

function buildAnonymousSessionId() {
  return `server-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function ingestTelemetryEvents(
  payload: unknown,
  options: IngestTelemetryEventsOptions = {},
) {
  const request = parseTelemetryIngestRequest(payload);
  const now = options.now ?? new Date();
  const receivedAt = now.toISOString();

  const events = request.events.map((event, index) => {
    return buildPersistedTelemetryEvent(event, {
      anonymousSessionId:
        event.anonymousSessionId ??
        `${buildAnonymousSessionId()}-${index.toString(36)}`,
      occurredAt: event.occurredAt ?? receivedAt,
      receivedAt,
      uid: options.uid ?? null,
    });
  });

  await saveTelemetryEvents(events);

  return {
    accepted: events.length,
  };
}

function buildCountEntries(
  values: Iterable<string | undefined>,
  maxEntries = 5,
): TelemetryCountEntry[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.label.localeCompare(right.label, "pt-BR");
    })
    .slice(0, maxEntries);
}

function buildSampledWindowLabel(events: PersistedTelemetryEvent[]) {
  if (events.length === 0) {
    return "Sem eventos coletados ainda";
  }

  const newest = events[0]?.receivedAt;
  const oldest = events.at(-1)?.receivedAt;

  if (!newest || !oldest) {
    return "Janela recente";
  }

  return `${oldest.slice(0, 16).replace("T", " ")} -> ${newest
    .slice(0, 16)
    .replace("T", " ")}`;
}

function buildSearchEventLabel(event: PersistedTelemetryEvent) {
  if (!event.query) {
    return undefined;
  }

  const layerLabel = buildLayerLabel(event) ?? "Sem camada";
  const dateLabel = event.activeDateLabel ?? "Sem data";

  return `${event.query} | ${layerLabel} | ${dateLabel}`;
}

function buildLayerLabel(event: PersistedTelemetryEvent) {
  const layerLabel = event.activeLayerName ?? event.activeLayerId;

  if (!layerLabel) {
    return undefined;
  }

  if (event.surface === "home") {
    return `Home - ${layerLabel}`;
  }

  return layerLabel;
}

export function buildTelemetryDashboardData(
  recentEvents: PersistedTelemetryEvent[],
): TelemetryDashboardData {
  return {
    sampledEventCount: recentEvents.length,
    sampledWindowLabel: buildSampledWindowLabel(recentEvents),
    lastReceivedAt: recentEvents[0]?.receivedAt ?? null,
    eventCounts: buildCountEntries(
      recentEvents.map((event) => event.eventName),
      8,
    ),
    surfaceCounts: buildCountEntries(
      recentEvents.map((event) => event.surface),
      4,
    ),
    topSearchQueries: buildCountEntries(
      recentEvents
        .filter((event) => event.eventName === "search_found")
        .map((event) => buildSearchEventLabel(event)),
    ),
    topNotFoundQueries: buildCountEntries(
      recentEvents
        .filter((event) => event.eventName === "search_not_found")
        .map((event) => buildSearchEventLabel(event)),
    ),
    topActivatedLayers: buildCountEntries(
      recentEvents
        .filter(
          (event) =>
            event.eventName === "layer_toggled" && event.action === "activated",
        )
        .map((event) => buildLayerLabel(event)),
    ),
    topDetailedLayers: buildCountEntries(
      recentEvents
        .filter((event) => event.eventName === "layer_details_opened")
        .map((event) => buildLayerLabel(event)),
    ),
    recentEvents,
  };
}

export async function getTelemetryDashboardData(
  sampleSize = 200,
): Promise<TelemetryDashboardData> {
  const recentEvents = await getRecentTelemetryEvents(sampleSize);
  return buildTelemetryDashboardData(recentEvents);
}
