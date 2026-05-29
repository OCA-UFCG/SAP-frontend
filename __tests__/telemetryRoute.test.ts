import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-session", () => ({
  getAuthenticatedUserSession: vi.fn(),
}));

vi.mock("@/app/api/logs/rate-limit", () => ({
  LOGS_RATE_LIMIT_MAX_ANONYMOUS_EVENTS: 60,
  LOGS_RATE_LIMIT_MAX_AUTHENTICATED_EVENTS: 120,
  consumeLogsRateLimit: vi.fn(() => ({
    limited: false,
    headers: {
      "X-RateLimit-Limit": "120",
      "X-RateLimit-Remaining": "119",
      "X-RateLimit-Reset": "9999999999",
    },
    retryAfterSeconds: 60,
  })),
}));

vi.mock("@/services/telemetry/telemetryService", () => ({
  ingestTelemetryEvents: vi.fn(),
}));

import { POST } from "@/app/api/logs/route";
import { consumeLogsRateLimit } from "@/app/api/logs/rate-limit";
import { getAuthenticatedUserSession } from "@/lib/server-session";
import { ingestTelemetryEvents } from "@/services/telemetry/telemetryService";
import { TelemetryValidationError } from "@/types/telemetry";

const mockedGetAuthenticatedUserSession = vi.mocked(
  getAuthenticatedUserSession,
);
const mockedConsumeLogsRateLimit = vi.mocked(consumeLogsRateLimit);
const mockedIngestTelemetryEvents = vi.mocked(ingestTelemetryEvents);

function createSameOriginHeaders() {
  return {
    origin: "https://example.test",
    "sec-fetch-site": "same-origin",
  };
}

describe("/api/logs", () => {
  beforeEach(() => {
    mockedGetAuthenticatedUserSession.mockReset();
    mockedConsumeLogsRateLimit.mockReset();
    mockedIngestTelemetryEvents.mockReset();
    mockedConsumeLogsRateLimit.mockReturnValue({
      limited: false,
      headers: {
        "X-RateLimit-Limit": "120",
        "X-RateLimit-Remaining": "119",
        "X-RateLimit-Reset": "9999999999",
      },
      retryAfterSeconds: 60,
    });
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
        headers: createSameOriginHeaders(),
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
        headers: createSameOriginHeaders(),
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    expect(mockedIngestTelemetryEvents).not.toHaveBeenCalled();
  });

  it("returns 400 when telemetry validation fails", async () => {
    mockedGetAuthenticatedUserSession.mockResolvedValueOnce(null);

    const payload = { events: [] };
    const response = await POST(
      new Request("https://example.test/api/logs", {
        method: "POST",
        headers: createSameOriginHeaders(),
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(400);
    expect(mockedIngestTelemetryEvents).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      error: "Telemetry payload must include between 1 and 20 events.",
    });
  });

  it("rejects cross-origin requests before calling the telemetry service", async () => {
    const response = await POST(
      new Request("https://example.test/api/logs", {
        method: "POST",
        headers: {
          origin: "https://attacker.test",
          "sec-fetch-site": "cross-site",
        },
        body: JSON.stringify({ events: [] }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mockedGetAuthenticatedUserSession).not.toHaveBeenCalled();
    expect(mockedIngestTelemetryEvents).not.toHaveBeenCalled();
  });

  it("returns 429 when the logs rate limit is exceeded", async () => {
    mockedGetAuthenticatedUserSession.mockResolvedValueOnce(null);
    mockedConsumeLogsRateLimit.mockReturnValueOnce({
      limited: true,
      headers: {
        "X-RateLimit-Limit": "60",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": "9999999999",
      },
      retryAfterSeconds: 45,
    });

    const response = await POST(
      new Request("https://example.test/api/logs", {
        method: "POST",
        headers: createSameOriginHeaders(),
        body: JSON.stringify({
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
        }),
      }),
    );

    expect(response.status).toBe(429);
    expect(mockedIngestTelemetryEvents).not.toHaveBeenCalled();
  });
});
