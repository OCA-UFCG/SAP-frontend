#!/usr/bin/env node
/**
 * Tira o e-mail e o uid dos eventos de uso que já estão gravados, e dá a cada
 * um a data em que a limpeza diária do servidor deve apagá-lo.
 *
 * A partir desta mudança, `/api/logs` grava só se a pessoa estava logada e um
 * `expireAt` de 90 dias. Os eventos antigos ficaram com `uid` e `userEmail` e
 * sem prazo nenhum: sem este script, eles continuariam no banco para sempre,
 * ligando cada busca a uma pessoa identificável.
 *
 *   node scripts/telemetry-remove-personal-data.mjs            # simulação
 *   node scripts/telemetry-remove-personal-data.mjs --apply
 *
 * Varre todas as coleções que começam com `telemetry-events` (local, beta,
 * gamma e produção dividem o mesmo projeto do Firebase).
 *
 * O script não apaga evento nenhum. Quem apaga é a limpeza diária do servidor
 * (ver `docs/telemetria.md`): um evento com mais de 90 dias recebe um
 * `expireAt` já vencido e some na próxima passada dela.
 *
 * É idempotente: um evento sem `uid`, sem `userEmail` e com `expireAt` é pulado.
 */

const TELEMETRY_COLLECTION_PREFIX = "telemetry-events";

// Espelha `TELEMETRY_RETENTION_DAYS` em
// `src/repositories/telemetry/telemetryRepository.ts`.
const RETENTION_DAYS = 90;

const BATCH_SIZE = 400;

export function needsCleanup(data) {
  return "uid" in data || "userEmail" in data || !("expireAt" in data);
}

/**
 * O que muda num evento antigo. `deleteField` é o `FieldValue.delete()` do
 * Admin SDK, recebido por parâmetro para o teste não precisar de credencial.
 */
export function buildCleanupUpdate(data, deleteField) {
  const receivedAt = Date.parse(data.receivedAt);
  const base = Number.isFinite(receivedAt) ? receivedAt : Date.now();

  return {
    uid: deleteField,
    userEmail: deleteField,
    authenticated:
      typeof data.authenticated === "boolean"
        ? data.authenticated
        : typeof data.uid === "string",
    expireAt: new Date(base + RETENTION_DAYS * 24 * 60 * 60 * 1000),
  };
}

async function main() {
  const apply = process.argv.slice(2).includes("--apply");

  // Importado só aqui para o arquivo poder ser importado por um teste sem
  // exigir credencial de Firebase Admin no ambiente.
  const { default: admin } = await import("firebase-admin");

  const privateKey = process.env.FIREBASE_PRIVATE_KEY_BASE64
    ? Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, "base64").toString(
        "utf8",
      )
    : process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Credenciais do Firebase Admin ausentes. Confira FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY (ou _BASE64).",
    );
    process.exit(1);
  }

  const app = admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
  const db = app.firestore();
  const deleteField = admin.firestore.FieldValue.delete();
  const now = Date.now();

  console.log(
    apply
      ? "Limpando os eventos de uso…"
      : "Simulação. Nada será gravado. Use --apply para valer.",
  );

  const collections = (await db.listCollections()).filter((ref) =>
    ref.id.startsWith(TELEMETRY_COLLECTION_PREFIX),
  );

  for (const collection of collections) {
    const snapshot = await collection.get();
    let withEmail = 0;
    let toUpdate = 0;
    let alreadyExpired = 0;
    let batch = db.batch();
    let pending = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();

      if (!needsCleanup(data)) continue;

      const update = buildCleanupUpdate(data, deleteField);

      toUpdate += 1;
      if (typeof data.userEmail === "string" && data.userEmail) withEmail += 1;
      if (update.expireAt.getTime() <= now) alreadyExpired += 1;

      if (apply) {
        batch.update(doc.ref, update);
        pending += 1;

        if (pending === BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          pending = 0;
        }
      }
    }

    if (apply && pending > 0) await batch.commit();

    console.log(
      `\n${collection.id}: ${snapshot.size} evento(s) · ${toUpdate} ${apply ? "atualizado(s)" : "seriam atualizados"} · ${withEmail} com e-mail · ${alreadyExpired} com mais de ${RETENTION_DAYS} dias (a limpeza apaga)`,
    );
  }

  if (!apply) {
    console.log("\nNada foi gravado. Rode de novo com --apply para aplicar.");
  }
}

// Só executa quando chamado direto pelo node; um import (o teste) não dispara.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
