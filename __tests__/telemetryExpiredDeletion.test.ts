import { beforeEach, describe, expect, it, vi } from "vitest";

const { events } = vi.hoisted(() => ({
  events: new Map<string, { expireAt: Date }>(),
}));

vi.mock("@/lib/firebase-admin", () => {
  function query(cutoff: Date | null, max: number) {
    return {
      where: (_field: string, _op: string, value: Date) => query(value, max),
      limit: (count: number) => query(cutoff, count),
      get: async () => {
        const docs = [...events.entries()]
          .filter(([, data]) => !cutoff || data.expireAt <= cutoff)
          .slice(0, max)
          .map(([id]) => ({ ref: id }));
        return { empty: docs.length === 0, size: docs.length, docs };
      },
    };
  }

  return {
    adminDb: {
      collection: () => query(null, Infinity),
      batch: () => {
        const pending: string[] = [];
        return {
          delete: (ref: string) => pending.push(ref),
          commit: async () => pending.forEach((id) => events.delete(id)),
        };
      },
    },
  };
});

import { deleteExpiredTelemetryEvents } from "@/repositories/telemetry/telemetryRepository";

const NOW = new Date("2026-10-26T12:00:00Z");

describe("deleteExpiredTelemetryEvents", () => {
  beforeEach(() => events.clear());

  it("deletes every expired event, across several batches, and keeps the rest", async () => {
    for (let index = 0; index < 950; index += 1) {
      events.set(`old-${index}`, { expireAt: new Date("2026-10-01T00:00:00Z") });
    }
    events.set("fresh", { expireAt: new Date("2027-01-01T00:00:00Z") });

    await expect(deleteExpiredTelemetryEvents(NOW)).resolves.toBe(950);
    expect([...events.keys()]).toEqual(["fresh"]);
  });

  it("does nothing when nothing has expired", async () => {
    events.set("fresh", { expireAt: new Date("2027-01-01T00:00:00Z") });

    await expect(deleteExpiredTelemetryEvents(NOW)).resolves.toBe(0);
    expect(events.size).toBe(1);
  });
});
