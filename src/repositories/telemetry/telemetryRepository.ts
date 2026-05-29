import type { DocumentData } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { PersistedTelemetryEvent } from "@/types/telemetry";

const TELEMETRY_COLLECTION_NAME =
  process.env.FIREBASE_TELEMETRY_COLLECTION?.trim() || "telemetryEvents";

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
