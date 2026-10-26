import { purgeExpiredSignups } from "@/lib/signup-retention";
import { deleteExpiredTelemetryEvents } from "@/repositories/telemetry/telemetryRepository";

/** Uma passada por dia basta para prazos contados em dias. */
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Apaga o que passou do prazo de guarda (LGPD): cadastros parados
 * (`signup-retention`) e eventos de uso vencidos (`telemetryRepository`).
 *
 * Vive no próprio servidor porque a TTL do Firestore só existe no plano pago, e
 * o projeto está no gratuito. Cada ambiente cuida só das próprias coleções. Uma
 * falha numa limpeza não impede a outra.
 */
async function runSweep() {
  try {
    const { unconfirmed, rejected } = await purgeExpiredSignups();

    if (unconfirmed || rejected) {
      console.info(
        `[retention] apagados ${unconfirmed} cadastro(s) não confirmado(s) e ${rejected} recusado(s) fora do prazo`,
      );
    }
  } catch (error) {
    console.error(
      "[retention] falha ao apagar cadastros fora do prazo:",
      error instanceof Error ? error.message : error,
    );
  }

  try {
    const events = await deleteExpiredTelemetryEvents();

    if (events) {
      console.info(`[retention] apagados ${events} evento(s) de uso vencido(s)`);
    }
  } catch (error) {
    console.error(
      "[retention] falha ao apagar eventos de uso vencidos:",
      error instanceof Error ? error.message : error,
    );
  }
}

/** Passa na subida do servidor e uma vez por dia depois disso. */
export function startRetentionSweep() {
  void runSweep();
  setInterval(() => {
    void runSweep();
  }, SWEEP_INTERVAL_MS).unref?.();
}
