import { describe, expect, it, vi } from "vitest";
import type { PersistedTelemetryEvent } from "@/types/telemetry";

const { batchSetMock, storedDocs } = vi.hoisted(() => ({
  batchSetMock: vi.fn(),
  storedDocs: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/firebase-admin", () => {
  const query = {
    orderBy: () => query,
    limit: () => query,
    get: async () => ({ docs: storedDocs.map((data) => ({ data: () => data })) }),
  };

  return {
    adminDb: {
      batch: () => ({ set: batchSetMock, commit: async () => undefined }),
      collection: () => ({ doc: () => ({}), ...query }),
    },
  };
});

import {
  DEFAULT_TELEMETRY_COLLECTION_NAME,
  getRecentTelemetryEvents,
  resolveProductionTelemetryCollectionName,
  resolveTelemetryCollectionName,
  saveTelemetryEvents,
  TELEMETRY_RETENTION_DAYS,
} from "@/repositories/telemetry/telemetryRepository";

const EVENT: PersistedTelemetryEvent = {
  eventName: "search_found",
  surface: "home",
  anonymousSessionId: "anon-1",
  occurredAt: "2026-10-18T12:00:00.000Z",
  receivedAt: "2026-10-18T12:00:00.000Z",
  receivedDay: "2026-10-18",
  authenticated: true,
};

describe("telemetryRepository", () => {
  it("defaults to the local collection when the env is missing", () => {
    expect(resolveTelemetryCollectionName(undefined)).toBe(
      DEFAULT_TELEMETRY_COLLECTION_NAME,
    );
  });

  it("defaults to the local collection when the env is blank", () => {
    expect(resolveTelemetryCollectionName("   ")).toBe(
      DEFAULT_TELEMETRY_COLLECTION_NAME,
    );
  });

  it("uses the configured collection name when provided", () => {
    expect(resolveTelemetryCollectionName("telemetry-events-beta")).toBe(
      "telemetry-events-beta",
    );
  });

  it("only reads the production collection where it is configured", () => {
    expect(resolveProductionTelemetryCollectionName(undefined)).toBeNull();
    expect(resolveProductionTelemetryCollectionName("  ")).toBeNull();
    expect(
      resolveProductionTelemetryCollectionName("telemetry-events-prod"),
    ).toBe("telemetry-events-prod");
  });

  it("stamps every event with the date the Firestore TTL deletes it", async () => {
    await saveTelemetryEvents([EVENT]);

    const [, written] = batchSetMock.mock.calls[0];
    const days =
      (written.expireAt.getTime() - Date.parse(EVENT.receivedAt)) /
      (24 * 60 * 60 * 1000);

    expect(written.expireAt).toBeInstanceOf(Date);
    expect(days).toBe(TELEMETRY_RETENTION_DAYS);
  });

  it("never hands an e-mail to the dashboard, even from events stored before the change", async () => {
    storedDocs.splice(0, storedDocs.length, {
      ...EVENT,
      authenticated: undefined,
      uid: "user-123",
      userEmail: "fulano@gmail.com",
      expireAt: new Date(),
    });

    const [event] = await getRecentTelemetryEvents();

    expect(event).not.toHaveProperty("userEmail");
    expect(event).not.toHaveProperty("uid");
    expect(event).not.toHaveProperty("expireAt");
    expect(event.authenticated).toBe(true);
  });
});
