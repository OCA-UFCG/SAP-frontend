import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {},
}));

import {
  DEFAULT_TELEMETRY_COLLECTION_NAME,
  resolveTelemetryCollectionName,
} from "@/repositories/telemetry/telemetryRepository";

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
});
