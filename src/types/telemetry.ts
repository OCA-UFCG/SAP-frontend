export const TELEMETRY_EVENT_NAMES = [
  "search_found",
  "search_not_found",
  "layer_toggled",
  "layer_details_opened",
] as const;

export const TELEMETRY_SURFACES = ["home", "analysis-panel"] as const;
export const SEARCH_SELECTION_METHODS = [
  "button",
  "enter",
  "option-click",
] as const;
export const RESOLVED_LOCATION_TYPES = ["uf", "city", "br"] as const;
export const LAYER_KINDS = ["vector", "ee"] as const;
export const LAYER_ACTIONS = ["activated", "deactivated"] as const;
export const PLATFORM_SECTIONS = [
  "monitoring",
  "analysis",
  "analysis-detail",
  "communication",
] as const;
export const TELEMETRY_BATCH_MAX_EVENTS = 20;

export type TelemetryEventName = (typeof TELEMETRY_EVENT_NAMES)[number];
export type TelemetrySurface = (typeof TELEMETRY_SURFACES)[number];
export type SearchSelectionMethod = (typeof SEARCH_SELECTION_METHODS)[number];
export type ResolvedLocationType = (typeof RESOLVED_LOCATION_TYPES)[number];
export type LayerKind = (typeof LAYER_KINDS)[number];
export type LayerAction = (typeof LAYER_ACTIONS)[number];
export type TelemetryPlatformSection = (typeof PLATFORM_SECTIONS)[number];

export interface TelemetryEventInput {
  eventName: TelemetryEventName;
  surface: TelemetrySurface;
  anonymousSessionId?: string;
  occurredAt?: string;
  query?: string;
  selectionMethod?: SearchSelectionMethod;
  visibleOptionCount?: number;
  resolvedLocationType?: ResolvedLocationType;
  resolvedStateKey?: string;
  resolvedMunicipalityCode?: string;
  activeLayerId?: string;
  activeLayerName?: string;
  activeDateLabel?: string;
  layerKind?: LayerKind;
  action?: LayerAction;
  activeSection?: string;
}

export interface TelemetryIngestRequest {
  events: TelemetryEventInput[];
}

export interface PersistedTelemetryEvent extends TelemetryEventInput {
  anonymousSessionId: string;
  occurredAt: string;
  receivedAt: string;
  receivedDay: string;
  uid: string | null;
  userEmail?: string | null;
}

export interface TelemetryCountEntry {
  label: string;
  count: number;
}

export interface TelemetryDashboardData {
  sampledEventCount: number;
  sampledWindowLabel: string;
  lastReceivedAt: string | null;
  eventCounts: TelemetryCountEntry[];
  surfaceCounts: TelemetryCountEntry[];
  topSearchQueries: TelemetryCountEntry[];
  topNotFoundQueries: TelemetryCountEntry[];
  topActivatedLayers: TelemetryCountEntry[];
  topDetailedLayers: TelemetryCountEntry[];
  recentEvents: PersistedTelemetryEvent[];
}

export class TelemetryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelemetryValidationError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRequiredEnum<T extends readonly string[]>(
  value: unknown,
  allowedValues: T,
  fieldName: string,
): T[number] {
  if (typeof value !== "string" || !allowedValues.includes(value)) {
    throw new TelemetryValidationError(
      `Invalid telemetry field: ${fieldName}.`,
    );
  }

  return value as T[number];
}

function parseOptionalEnum<T extends readonly string[]>(
  value: unknown,
  allowedValues: T,
  fieldName: string,
) {
  if (value == null) {
    return undefined;
  }

  return parseRequiredEnum(value, allowedValues, fieldName);
}

function parseOptionalString(value: unknown, fieldName: string) {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new TelemetryValidationError(
      `Invalid telemetry field: ${fieldName}.`,
    );
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function parseOptionalInteger(value: unknown, fieldName: string) {
  if (value == null) {
    return undefined;
  }

  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new TelemetryValidationError(
      `Invalid telemetry field: ${fieldName}.`,
    );
  }

  return value as number;
}

function parseOptionalDateString(value: unknown, fieldName: string) {
  const normalized = parseOptionalString(value, fieldName);

  if (!normalized) {
    return undefined;
  }

  if (Number.isNaN(Date.parse(normalized))) {
    throw new TelemetryValidationError(
      `Invalid telemetry field: ${fieldName}.`,
    );
  }

  return normalized;
}

export function parseTelemetryEventInput(value: unknown): TelemetryEventInput {
  if (!isPlainObject(value)) {
    throw new TelemetryValidationError("Invalid telemetry payload.");
  }

  const eventName = parseRequiredEnum(
    value.eventName,
    TELEMETRY_EVENT_NAMES,
    "eventName",
  );
  const surface = parseRequiredEnum(
    value.surface,
    TELEMETRY_SURFACES,
    "surface",
  );
  const query = parseOptionalString(value.query, "query");
  const activeLayerId = parseOptionalString(
    value.activeLayerId,
    "activeLayerId",
  );
  const activeLayerName = parseOptionalString(
    value.activeLayerName,
    "activeLayerName",
  );
  const activeDateLabel = parseOptionalString(
    value.activeDateLabel,
    "activeDateLabel",
  );
  const selectionMethod = parseOptionalEnum(
    value.selectionMethod,
    SEARCH_SELECTION_METHODS,
    "selectionMethod",
  );
  const resolvedLocationType = parseOptionalEnum(
    value.resolvedLocationType,
    RESOLVED_LOCATION_TYPES,
    "resolvedLocationType",
  );
  const layerKind = parseOptionalEnum(
    value.layerKind,
    LAYER_KINDS,
    "layerKind",
  );
  const action = parseOptionalEnum(value.action, LAYER_ACTIONS, "action");

  if (
    (eventName === "search_found" || eventName === "search_not_found") &&
    (!query || !selectionMethod || !activeLayerId || !activeDateLabel)
  ) {
    throw new TelemetryValidationError(
      "Search telemetry must include query, selectionMethod, activeLayerId, and activeDateLabel.",
    );
  }

  if (eventName === "layer_toggled" && (!action || !layerKind)) {
    throw new TelemetryValidationError(
      "Layer toggle telemetry must include action and layerKind.",
    );
  }

  if (
    (eventName === "layer_toggled" || eventName === "layer_details_opened") &&
    !activeLayerId
  ) {
    throw new TelemetryValidationError(
      "Layer telemetry must include activeLayerId.",
    );
  }

  return {
    eventName,
    surface,
    anonymousSessionId: parseOptionalString(
      value.anonymousSessionId,
      "anonymousSessionId",
    ),
    occurredAt: parseOptionalDateString(value.occurredAt, "occurredAt"),
    query,
    selectionMethod,
    visibleOptionCount: parseOptionalInteger(
      value.visibleOptionCount,
      "visibleOptionCount",
    ),
    resolvedLocationType,
    resolvedStateKey: parseOptionalString(
      value.resolvedStateKey,
      "resolvedStateKey",
    ),
    resolvedMunicipalityCode: parseOptionalString(
      value.resolvedMunicipalityCode,
      "resolvedMunicipalityCode",
    ),
    activeLayerId,
    activeLayerName,
    activeDateLabel,
    layerKind,
    action,
    activeSection: parseOptionalEnum(
      value.activeSection,
      PLATFORM_SECTIONS,
      "activeSection",
    ),
  };
}

export function parseTelemetryIngestRequest(
  value: unknown,
): TelemetryIngestRequest {
  if (!isPlainObject(value) || !Array.isArray(value.events)) {
    throw new TelemetryValidationError(
      "Telemetry payload must include events.",
    );
  }

  if (
    value.events.length === 0 ||
    value.events.length > TELEMETRY_BATCH_MAX_EVENTS
  ) {
    throw new TelemetryValidationError(
      `Telemetry payload must include between 1 and ${TELEMETRY_BATCH_MAX_EVENTS} events.`,
    );
  }

  return {
    events: value.events.map((event) => parseTelemetryEventInput(event)),
  };
}

export function buildPersistedTelemetryEvent(
  event: TelemetryEventInput,
  {
    anonymousSessionId,
    occurredAt,
    receivedAt,
    uid,
    userEmail,
  }: {
    anonymousSessionId: string;
    occurredAt: string;
    receivedAt: string;
    uid: string | null;
    userEmail: string | null;
  },
): PersistedTelemetryEvent {
  return {
    ...event,
    anonymousSessionId,
    occurredAt,
    receivedAt,
    receivedDay: receivedAt.slice(0, 10),
    uid,
    userEmail,
  };
}
