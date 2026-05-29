import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/telemetry/telemetryRepository", () => ({
  getRecentTelemetryEvents: vi.fn(),
  saveTelemetryEvents: vi.fn(),
}));

import {
  buildTelemetryDashboardData,
  getTelemetryDashboardData,
} from "@/services/telemetry/telemetryService";
import { getRecentTelemetryEvents } from "@/repositories/telemetry/telemetryRepository";
import type { PersistedTelemetryEvent } from "@/types/telemetry";

const mockedGetRecentTelemetryEvents = vi.mocked(getRecentTelemetryEvents);

function createEvent(
  overrides: Partial<PersistedTelemetryEvent>,
): PersistedTelemetryEvent {
  return {
    eventName: "search_found",
    surface: "analysis-panel",
    anonymousSessionId: "anon-1",
    occurredAt: "2026-05-29T12:00:00.000Z",
    receivedAt: "2026-05-29T12:00:01.000Z",
    receivedDay: "2026-05-29",
    uid: null,
    query: "sao paulo",
    selectionMethod: "button",
    activeLayerId: "layer-1",
    activeLayerName: "Camada de teste",
    activeDateLabel: "2024",
    ...overrides,
  };
}

describe("telemetryService", () => {
  beforeEach(() => {
    mockedGetRecentTelemetryEvents.mockReset();
  });

  it("builds dashboard aggregates from recent telemetry events", () => {
    const data = buildTelemetryDashboardData([
      createEvent({
        receivedAt: "2026-05-29T12:10:00.000Z",
        query: "campina grande - pb",
      }),
      createEvent({
        eventName: "search_not_found",
        receivedAt: "2026-05-29T12:09:00.000Z",
        query: "cidade sem dado",
      }),
      createEvent({
        eventName: "layer_toggled",
        surface: "home",
        receivedAt: "2026-05-29T12:08:00.000Z",
        activeLayerId: "CDI",
        activeLayerName: "CDI Janeiro 2024",
        layerKind: "vector",
        action: "activated",
        query: undefined,
        selectionMethod: undefined,
      }),
      createEvent({
        eventName: "layer_details_opened",
        surface: "home",
        receivedAt: "2026-05-29T12:07:00.000Z",
        activeLayerId: "CDI",
        activeLayerName: "CDI Janeiro 2024",
        layerKind: "vector",
        query: undefined,
        selectionMethod: undefined,
      }),
    ]);

    expect(data.sampledEventCount).toBe(4);
    expect(data.lastReceivedAt).toBe("2026-05-29T12:10:00.000Z");
    expect(data.topSearchQueries).toEqual([
      { label: "campina grande - pb | Camada de teste | 2024", count: 1 },
    ]);
    expect(data.topNotFoundQueries).toEqual([
      { label: "cidade sem dado | Camada de teste | 2024", count: 1 },
    ]);
    expect(data.topActivatedLayers).toEqual([
      { label: "Home - CDI Janeiro 2024", count: 1 },
    ]);
    expect(data.topDetailedLayers).toEqual([
      { label: "Home - CDI Janeiro 2024", count: 1 },
    ]);
  });

  it("loads recent events from the repository when building the dashboard", async () => {
    mockedGetRecentTelemetryEvents.mockResolvedValueOnce([
      createEvent({ query: "brasil" }),
    ]);

    const data = await getTelemetryDashboardData(120);

    expect(mockedGetRecentTelemetryEvents).toHaveBeenCalledWith(120);
    expect(data.sampledEventCount).toBe(1);
    expect(data.topSearchQueries).toEqual([
      { label: "brasil | Camada de teste | 2024", count: 1 },
    ]);
  });
});
