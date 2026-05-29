import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-session", () => ({
  getAuthenticatedUserSession: vi.fn(),
}));

vi.mock("@/services/telemetry/telemetryService", () => ({
  ingestTelemetryEvents: vi.fn(),
}));

import { POST } from "@/app/api/logs/route";
import { getAuthenticatedUserSession } from "@/lib/server-session";
import { ingestTelemetryEvents } from "@/services/telemetry/telemetryService";
import { TelemetryValidationError } from "@/types/telemetry";

const mockedGetAuthenticatedUserSession = vi.mocked(
  getAuthenticatedUserSession,
);
const mockedIngestTelemetryEvents = vi.mocked(ingestTelemetryEvents);

describe("/api/logs", () => {
  beforeEach(() => {
    mockedGetAuthenticatedUserSession.mockReset();
    mockedIngestTelemetryEvents.mockReset();
  });

  it("accepts valid telemetry payloads and forwards the authenticated identity", async () => {
    mockedGetAuthenticatedUserSession.mockResolvedValueOnce({
      uid: "user-123",
      email: "oca@gmail.com",
    });
    mockedIngestTelemetryEvents.mockResolvedValueOnce({ accepted: 1 });

    const payload = {
      events: [
        {
          eventName: "search_not_found",
          surface: "home",
          query: "cidade inexistente",
          selectionMethod: "button",
          anonymousSessionId: "anon-1",
          activeLayerId: "CDI",
          activeLayerName: "CDI Janeiro 2024",
          activeDateLabel: "31/01/24",
        },
      ],
    };

    const response = await POST(
      new Request("https://example.test/api/logs", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(202);
    expect(mockedGetAuthenticatedUserSession).toHaveBeenCalledTimes(1);
    expect(mockedIngestTelemetryEvents).toHaveBeenCalledWith(payload, {
      uid: "user-123",
      userEmail: "oca@gmail.com",
    });
  });

  it("rejects invalid JSON payloads before calling the telemetry service", async () => {
    const response = await POST(
      new Request("https://example.test/api/logs", {
        method: "POST",
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    expect(mockedIngestTelemetryEvents).not.toHaveBeenCalled();
  });

  it("returns 400 when telemetry validation fails", async () => {
    mockedGetAuthenticatedUserSession.mockResolvedValueOnce(null);
    mockedIngestTelemetryEvents.mockRejectedValueOnce(
      new TelemetryValidationError("Telemetry payload must include events."),
    );

    const payload = { events: [] };
    const response = await POST(
      new Request("https://example.test/api/logs", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Telemetry payload must include events.",
    });
  });
});
