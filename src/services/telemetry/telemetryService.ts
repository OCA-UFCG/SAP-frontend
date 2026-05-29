import { getAnalysisYearOptions } from "@/components/analysis/analysis.mappers";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import {
  getRecentTelemetryEvents,
  saveTelemetryEvents,
} from "@/repositories/telemetry/telemetryRepository";
import {
  buildPersistedTelemetryEvent,
  parseTelemetryIngestRequest,
  TelemetryValidationError,
  type TelemetryEventInput,
  type PersistedTelemetryEvent,
  type TelemetryCountEntry,
  type TelemetryDashboardData,
} from "@/types/telemetry";
import type { PanelLayerI } from "@/utils/interfaces";

interface IngestTelemetryEventsOptions {
  uid?: string | null;
  userEmail?: string | null;
  now?: Date;
}

const HOME_TELEMETRY_LAYER = {
  id: "CDI",
  name: "CDI Janeiro 2024",
  activeDateLabel: "31/01/24",
} as const;
const TELEMETRY_LAYER_CATALOG_TTL_MS = 1000 * 60 * 5;

let cachedAnalysisLayersById = new Map<string, PanelLayerI>();
let cachedAnalysisLayersExpiresAt = 0;

function buildAnonymousSessionId() {
  return `server-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getTrustedAnalysisLayersById() {
  const now = Date.now();

  if (
    cachedAnalysisLayersById.size > 0 &&
    now < cachedAnalysisLayersExpiresAt
  ) {
    return cachedAnalysisLayersById;
  }

  const panelLayers = await getPanelLayers();

  if (panelLayers.length > 0) {
    cachedAnalysisLayersById = new Map(
      panelLayers.map((layer) => [layer.id, layer]),
    );
    cachedAnalysisLayersExpiresAt = now + TELEMETRY_LAYER_CATALOG_TTL_MS;
  }

  return cachedAnalysisLayersById;
}

function buildAllowedAnalysisDateLabels(layer: PanelLayerI) {
  const allowedLabels = new Set<string>();

  getAnalysisYearOptions(layer).forEach((option) => {
    allowedLabels.add(option.value);
    allowedLabels.add(option.label);
  });

  return allowedLabels;
}

function sanitizeHomeTelemetryEvent(
  event: TelemetryEventInput,
): TelemetryEventInput {
  if (event.activeLayerId && event.activeLayerId !== HOME_TELEMETRY_LAYER.id) {
    throw new TelemetryValidationError(
      "Invalid telemetry field: activeLayerId.",
    );
  }

  return {
    ...event,
    activeLayerId: HOME_TELEMETRY_LAYER.id,
    activeLayerName: HOME_TELEMETRY_LAYER.name,
    activeDateLabel: HOME_TELEMETRY_LAYER.activeDateLabel,
  };
}

function sanitizeAnalysisPanelTelemetryEvent(
  event: TelemetryEventInput,
  analysisLayersById: Map<string, PanelLayerI>,
): TelemetryEventInput {
  if (!event.activeLayerId) {
    return event;
  }

  if (analysisLayersById.size === 0) {
    return {
      ...event,
      activeLayerName: undefined,
    };
  }

  const layer = analysisLayersById.get(event.activeLayerId);

  if (!layer) {
    throw new TelemetryValidationError(
      "Invalid telemetry field: activeLayerId.",
    );
  }

  if (event.activeDateLabel) {
    const allowedDateLabels = buildAllowedAnalysisDateLabels(layer);

    if (
      allowedDateLabels.size > 0 &&
      !allowedDateLabels.has(event.activeDateLabel)
    ) {
      throw new TelemetryValidationError(
        "Invalid telemetry field: activeDateLabel.",
      );
    }
  }

  return {
    ...event,
    activeLayerName: layer.name,
  };
}

async function sanitizeTelemetryEvents(events: TelemetryEventInput[]) {
  const analysisLayersById = await getTrustedAnalysisLayersById();

  return events.map((event) => {
    if (event.surface === "home") {
      return sanitizeHomeTelemetryEvent(event);
    }

    return sanitizeAnalysisPanelTelemetryEvent(event, analysisLayersById);
  });
}

export async function ingestTelemetryEvents(
  payload: unknown,
  options: IngestTelemetryEventsOptions = {},
) {
  const request = parseTelemetryIngestRequest(payload);
  const now = options.now ?? new Date();
  const receivedAt = now.toISOString();
  const sanitizedEvents = await sanitizeTelemetryEvents(request.events);

  const events = sanitizedEvents.map((event, index) => {
    return buildPersistedTelemetryEvent(event, {
      anonymousSessionId:
        event.anonymousSessionId ??
        `${buildAnonymousSessionId()}-${index.toString(36)}`,
      occurredAt: receivedAt,
      receivedAt,
      uid: options.uid ?? null,
      userEmail: options.userEmail ?? null,
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

export function clearTelemetryIngestValidationCache() {
  cachedAnalysisLayersById.clear();
  cachedAnalysisLayersExpiresAt = 0;
}
