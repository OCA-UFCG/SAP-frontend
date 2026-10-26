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

/**
 * Coleção em que a produção grava o uso. Só o beta define
 * `FIREBASE_TELEMETRY_COLLECTION_PRODUCTION`: a Auditoria fica só no beta e,
 * com ela, também mostra o uso da produção. Sem a variável, a Auditoria lê só
 * o próprio ambiente.
 */
export function resolveProductionTelemetryCollectionName(
  value = process.env.FIREBASE_TELEMETRY_COLLECTION_PRODUCTION,
) {
  return value?.trim() || null;
}

/**
 * Por quanto tempo um evento de uso fica guardado. O painel de Auditoria só lê
 * os 200 mais recentes, então nada na plataforma depende de eventos mais
 * antigos que isso — e dado guardado sem prazo é dado guardado sem motivo.
 */
export const TELEMETRY_RETENTION_DAYS = 90;

/**
 * Quando o evento vence. `deleteExpiredTelemetryEvents` apaga os vencidos (ver
 * `docs/telemetria.md`). É um Timestamp, que o Admin SDK converte do `Date` na
 * gravação, para servir também à TTL do Firestore se o projeto for para o
 * plano pago um dia.
 */
export const TELEMETRY_EXPIRE_AT_FIELD = "expireAt";

/** Um lote do Firestore aceita até 500 operações. */
const DELETE_BATCH_SIZE = 400;

export function buildTelemetryExpireAt(receivedAt: string) {
  return new Date(
    Date.parse(receivedAt) + TELEMETRY_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
}

/**
 * Apaga os eventos que passaram do prazo, em lotes, até não sobrar nenhum.
 *
 * Faz o papel da TTL do Firestore, que só existe no plano pago: o projeto está
 * no gratuito. Cada ambiente apaga só a própria coleção. A consulta usa o
 * índice simples de `expireAt`, que o Firestore cria sozinho.
 */
export async function deleteExpiredTelemetryEvents(now = new Date()) {
  const collection = adminDb.collection(TELEMETRY_COLLECTION_NAME);
  let deleted = 0;

  for (;;) {
    const snapshot = await collection
      .where(TELEMETRY_EXPIRE_AT_FIELD, "<=", now)
      .limit(DELETE_BATCH_SIZE)
      .get();

    if (snapshot.empty) return deleted;

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.size;
  }
}

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
    batch.set(collection.doc(), {
      ...stripUndefinedFields(event),
      [TELEMETRY_EXPIRE_AT_FIELD]: buildTelemetryExpireAt(event.receivedAt),
    });
  });

  await batch.commit();
}

export async function getRecentTelemetryEvents(
  limitCount = 200,
  collectionName = TELEMETRY_COLLECTION_NAME,
): Promise<PersistedTelemetryEvent[]> {
  const snapshot = await adminDb
    .collection(collectionName)
    .orderBy("receivedAt", "desc")
    .limit(limitCount)
    .get();

  return snapshot.docs.map((doc) => toDashboardEvent(doc.data()));
}

/**
 * O que sai do banco para a tela. Tira o `expireAt` (um Timestamp, que não
 * atravessa para o componente do cliente) e também o `uid` e o `userEmail`
 * que os eventos antigos ainda carregam até o script de limpeza rodar — assim
 * a Auditoria para de mostrar e-mails já no deploy, sem depender dele.
 */
function toDashboardEvent(data: DocumentData): PersistedTelemetryEvent {
  const { uid, ...event } = data;

  delete event[TELEMETRY_EXPIRE_AT_FIELD];
  delete event.userEmail;

  return {
    ...event,
    authenticated:
      typeof event.authenticated === "boolean"
        ? event.authenticated
        : typeof uid === "string",
  } as PersistedTelemetryEvent;
}
