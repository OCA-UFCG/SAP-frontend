import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { readStoredAccess } from "@/lib/access-claims";
import {
  ACCESS_REQUESTS_COLLECTION,
  type AccessRequest,
} from "@/lib/access-requests";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Por quanto tempo um cadastro que nunca confirmou o e-mail fica guardado. O
 * link de confirmação vence bem antes disso; passado o prazo, ninguém provou
 * ser dono do endereço e não há motivo para guardar o e-mail e o motivo de uso.
 */
export const UNCONFIRMED_SIGNUP_RETENTION_DAYS = 30;

/**
 * Por quanto tempo um pedido recusado fica guardado. A conta recusada fica
 * desabilitada nesse meio-tempo, e é ela que impede a mesma pessoa de pedir de
 * novo logo em seguida. Depois do prazo, conta e registro somem, e um cadastro
 * novo volta a ser possível.
 */
export const REJECTED_SIGNUP_RETENTION_DAYS = 180;

/** Uma passada por dia basta para prazos contados em dias. */
const SWEEP_INTERVAL_MS = DAY_MS;

export interface SignupPurgeResult {
  unconfirmed: number;
  rejected: number;
}

function olderThan(isoDate: string | null, days: number, now: number) {
  const time = Date.parse(isoDate ?? "");
  return Number.isFinite(time) && now - time > days * DAY_MS;
}

/**
 * Apaga os cadastros que passaram do prazo: a conta do Firebase e o registro
 * do pedido.
 *
 * Só entra quem tem pedido **nesta** coleção. O projeto do Firebase é dividido
 * com outros sistemas, então uma conta sem pedido nosso pode ser de outro
 * sistema e nunca é tocada. Pelo mesmo motivo, uma conta que já carrega a marca
 * do SAP (liberada ou removida) fica de fora, qualquer que seja o pedido.
 *
 * Lê só por status e filtra a data aqui: são poucos pedidos, e filtrar no
 * Firestore exigiria um índice composto a mais.
 */
export async function purgeExpiredSignups(
  now = Date.now(),
): Promise<SignupPurgeResult> {
  const collection = adminDb.collection(ACCESS_REQUESTS_COLLECTION);
  const [pending, rejected] = await Promise.all([
    collection.where("status", "==", "pending").get(),
    collection.where("status", "==", "rejected").get(),
  ]);

  const candidates = [
    ...pending.docs
      .filter((doc) =>
        olderThan(
          (doc.data() as AccessRequest).createdAt,
          UNCONFIRMED_SIGNUP_RETENTION_DAYS,
          now,
        ),
      )
      .map((doc) => ({ uid: doc.id, kind: "unconfirmed" as const })),
    ...rejected.docs
      .filter((doc) =>
        olderThan(
          (doc.data() as AccessRequest).decidedAt,
          REJECTED_SIGNUP_RETENTION_DAYS,
          now,
        ),
      )
      .map((doc) => ({ uid: doc.id, kind: "rejected" as const })),
  ];

  const result: SignupPurgeResult = { unconfirmed: 0, rejected: 0 };

  for (const { uid, kind } of candidates) {
    const user = await adminAuth.getUser(uid).catch(() => null);

    if (user && readStoredAccess(user.customClaims)) continue;
    // Pendente e confirmado está esperando a equipe, não abandonado.
    if (kind === "unconfirmed" && user?.emailVerified) continue;
    // Recusado e reabilitado pelo painel do Firebase: alguém mudou de ideia.
    if (kind === "rejected" && user && !user.disabled) continue;

    // A conta vai primeiro, ao contrário de `deleteAccount`: aqui é o pedido
    // que faz a próxima passada voltar. Se apagar o registro falhar, ele ainda
    // está lá amanhã, já sem conta, e sai na próxima.
    if (user) await adminAuth.deleteUser(uid);
    await collection.doc(uid).delete();

    result[kind] += 1;
  }

  return result;
}

async function runSweep() {
  try {
    const { unconfirmed, rejected } = await purgeExpiredSignups();

    if (unconfirmed || rejected) {
      console.info(
        `[signup-retention] apagados ${unconfirmed} cadastro(s) não confirmado(s) e ${rejected} recusado(s) fora do prazo`,
      );
    }
  } catch (error) {
    console.error(
      "[signup-retention] falha ao apagar cadastros fora do prazo:",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Passa na subida do servidor e uma vez por dia depois disso. Cada ambiente
 * cuida só da própria coleção de pedidos.
 */
export function startSignupRetentionSweep() {
  void runSweep();
  setInterval(() => {
    void runSweep();
  }, SWEEP_INTERVAL_MS).unref?.();
}
