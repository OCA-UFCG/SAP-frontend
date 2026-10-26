import { describe, expect, it, vi } from "vitest";
import {
  buildCleanupUpdate,
  needsCleanup,
} from "../scripts/telemetry-remove-personal-data.mjs";
import { TELEMETRY_RETENTION_DAYS } from "@/repositories/telemetry/telemetryRepository";

vi.mock("@/lib/firebase-admin", () => ({ adminDb: {} }));

const DELETE = Symbol("delete");

describe("telemetry-remove-personal-data", () => {
  it("cleans events that still carry identity or have no expiry", () => {
    expect(needsCleanup({ uid: null, expireAt: new Date() })).toBe(true);
    expect(needsCleanup({ userEmail: "a@b.c", expireAt: new Date() })).toBe(true);
    expect(needsCleanup({ authenticated: true })).toBe(true);
    expect(needsCleanup({ authenticated: true, expireAt: new Date() })).toBe(false);
  });

  it("removes the e-mail and the uid, keeps whether there was a session", () => {
    const update = buildCleanupUpdate(
      {
        receivedAt: "2026-06-01T00:00:00.000Z",
        uid: "user-123",
        userEmail: "fulano@gmail.com",
      },
      DELETE,
    );

    expect(update.uid).toBe(DELETE);
    expect(update.userEmail).toBe(DELETE);
    expect(update.authenticated).toBe(true);
  });

  it("uses the same retention as the app, counted from when the event arrived", () => {
    const update = buildCleanupUpdate(
      { receivedAt: "2026-06-01T00:00:00.000Z", uid: null },
      DELETE,
    );
    const days =
      (update.expireAt.getTime() - Date.parse("2026-06-01T00:00:00.000Z")) /
      (24 * 60 * 60 * 1000);

    expect(days).toBe(TELEMETRY_RETENTION_DAYS);
    expect(update.authenticated).toBe(false);
  });
});
