import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/telemetry/telemetryRepository", () => ({
  getRecentTelemetryEvents: vi.fn(),
  saveTelemetryEvents: vi.fn(),
}));

vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayers: vi.fn(),
}));

import {
  buildTelemetryDashboardData,
  clearTelemetryIngestValidationCache,
  getTelemetryDashboardData,
  ingestTelemetryEvents,
} from "@/services/telemetry/telemetryService";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import {
  getRecentTelemetryEvents,
  saveTelemetryEvents,
} from "@/repositories/telemetry/telemetryRepository";
import type { PersistedTelemetryEvent } from "@/types/telemetry";
import { TelemetryValidationError } from "@/types/telemetry";
import type { PanelLayerI } from "@/utils/interfaces";

const mockedGetRecentTelemetryEvents = vi.mocked(getRecentTelemetryEvents);
const mockedGetPanelLayers = vi.mocked(getPanelLayers);
const mockedSaveTelemetryEvents = vi.mocked(saveTelemetryEvents);

function createPanelLayer(overrides: Partial<PanelLayerI> = {}): PanelLayerI {
  return {
    sys: { id: "sys-layer-1" },
    id: "layer-1",
    name: "Camada de teste",
    description: "Descricao da camada",
    panelPosition: 1,
    previewMap: {
      url: "https://example.test/layer.png",
    },
    imageData: {
      "2024": {
        default: true,
        year: "2024",
        imageId: "image-1",
        imageParams: [],
      },
    },
    ...overrides,
  };
}

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
    clearTelemetryIngestValidationCache();
    mockedGetRecentTelemetryEvents.mockReset();
    mockedGetPanelLayers.mockReset();
    mockedSaveTelemetryEvents.mockReset();
    mockedGetPanelLayers.mockResolvedValue([createPanelLayer()]);
  });

  it("persists the authenticated user email with server-controlled telemetry metadata", async () => {
    mockedSaveTelemetryEvents.mockResolvedValueOnce();

    const result = await ingestTelemetryEvents(
      {
        events: [
          {
            eventName: "layer_toggled",
            surface: "analysis-panel",
            anonymousSessionId: "anon-1",
            occurredAt: "2024-01-01T00:00:00.000Z",
            activeLayerId: "layer-1",
            activeLayerName: "Layer spoofado",
            layerKind: "vector",
            action: "activated",
          },
        ],
      },
      {
        uid: "user-123",
        userEmail: "oca@gmail.com",
        now: new Date("2026-05-29T12:00:01.000Z"),
      },
    );

    expect(result).toEqual({ accepted: 1 });
    expect(mockedSaveTelemetryEvents).toHaveBeenCalledWith([
      expect.objectContaining({
        uid: "user-123",
        userEmail: "oca@gmail.com",
        anonymousSessionId: "anon-1",
        occurredAt: "2026-05-29T12:00:01.000Z",
        receivedAt: "2026-05-29T12:00:01.000Z",
        receivedDay: "2026-05-29",
        activeLayerName: "Camada de teste",
      }),
    ]);
  });

  it("rejects unknown analysis-panel layer identifiers", async () => {
    await expect(
      ingestTelemetryEvents(
        {
          events: [
            {
              eventName: "layer_details_opened",
              surface: "analysis-panel",
              anonymousSessionId: "anon-1",
              activeLayerId: "unknown-layer",
            },
          ],
        },
        {
          now: new Date("2026-05-29T12:00:01.000Z"),
        },
      ),
    ).rejects.toThrowError(
      new TelemetryValidationError("Invalid telemetry field: activeLayerId."),
    );
  });

  it("rejects analysis telemetry with an unknown active date label", async () => {
    await expect(
      ingestTelemetryEvents(
        {
          events: [
            {
              eventName: "search_found",
              surface: "analysis-panel",
              anonymousSessionId: "anon-1",
              query: "paraiba",
              selectionMethod: "button",
              activeLayerId: "layer-1",
              activeDateLabel: "2099",
            },
          ],
        },
        {
          now: new Date("2026-05-29T12:00:01.000Z"),
        },
      ),
    ).rejects.toThrowError(
      new TelemetryValidationError("Invalid telemetry field: activeDateLabel."),
    );
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
