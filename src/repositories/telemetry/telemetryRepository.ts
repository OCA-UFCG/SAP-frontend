import type { DocumentData } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { PersistedTelemetryEvent } from "@/types/telemetry";

export const DEFAULT_TELEMETRY_COLLECTION_NAME = "telemetry-events-local";

export function resolveTelemetryCollectionName(
  value = process.env.FIREBASE_TELEMETRY_COLLECTION,
) {
  return value?.trim() || DEFAULT_TELEMETRY_COLLECTION_NAME;
}

const TELEMETRY_COLLECTION_NAME = resolveTelemetryCollectionName();

function stripUndefinedFields<T extends object>(value: T): DocumentData {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  );
}

export async function saveTelemetryEvents(
  events: PersistedTelemetryEvent[],
): Promise<void> {
  const batch = adminDb.batch();
  const collection = adminDb.collection(TELEMETRY_COLLECTION_NAME);

  events.forEach((event) => {
    batch.set(collection.doc(), stripUndefinedFields(event));
  });

  await batch.commit();
}

export async function getRecentTelemetryEvents(
  limitCount = 200,
): Promise<PersistedTelemetryEvent[]> {
  const snapshot = await adminDb
    .collection(TELEMETRY_COLLECTION_NAME)
    .orderBy("receivedAt", "desc")
    .limit(limitCount)
    .get();

  return snapshot.docs.map((doc) => doc.data() as PersistedTelemetryEvent);
}
