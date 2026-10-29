import "server-only";

import { getContent } from "@/infrastructure/contentful/client";
import { pingGee } from "@/infrastructure/earth-engine/client";
import { adminDb } from "@/lib/firebase-admin";
import { isMailerConfigured, verifyMailer } from "@/lib/mailer";

export type DependencyName =
  | "gee"
  | "contentful"
  | "firebase"
  | "multicriteria"
  | "smtp";

export interface DependencyStatus {
  ok: boolean;
  latencyMs: number;
  /** Só a categoria da falha; a mensagem original fica no log do servidor. */
  error?: string;
}

export interface HealthReport {
  status: "ok" | "fail";
  checkedAt: string;
  dependencies: Record<DependencyName, DependencyStatus>;
}

/** Bem abaixo dos 30 s que um monitor costuma esperar pela resposta. */
export const HEALTH_CHECK_TIMEOUT_MS = 8_000;
/**
 * Por quanto tempo uma verificação vale para os pedidos seguintes.
 *
 * A rota é pública: sem isso, cada pedido a ela viraria uma ida a cada uma das
 * cinco dependências, e alguém chamando em laço gastaria a cota delas.
 */
export const HEALTH_REPORT_TTL_MS = 30_000;
/**
 * O SMTP é conferido com menos frequência que o resto: cada verificação é um
 * login na conta do Google, e um login a cada 30 s o dia inteiro tem cara de
 * abuso para o Google. Só o sucesso é guardado, para uma falha ser conferida
 * de novo já na verificação seguinte.
 */
export const SMTP_OK_TTL_MS = 10 * 60_000;
/**
 * O Contentful também: cada verificação é uma chamada que conta na cota de
 * 100 mil por mês do espaço. Conferido a cada minuto em beta e produção, o
 * monitor sozinho gastava 2.880 por dia (~86 mil por mês) e levou outubro de
 * 2026 a 82% da cota. A cada 15 min são ~190 por dia nos dois ambientes.
 */
export const CONTENTFUL_OK_TTL_MS = 15 * 60_000;

class NotConfiguredError extends Error {}
class TimeoutError extends Error {}
class HttpStatusError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

function requireEnv(...names: string[]) {
  if (names.some((name) => !process.env[name]?.trim())) {
    throw new NotConfiguredError(`Faltam variáveis: ${names.join(", ")}`);
  }
}

const CHECKS: Record<DependencyName, () => Promise<void>> = {
  async gee() {
    requireEnv("GEE_PRIVATE_KEY");
    await pingGee();
  },
  async contentful() {
    if (contentfulOkUntil > Date.now()) return;
    await getContent<{ __typename: string }>("query { __typename }", undefined, {
      cache: "no-store",
    });
    contentfulOkUntil = Date.now() + CONTENTFUL_OK_TTL_MS;
  },
  async firebase() {
    requireEnv("FIREBASE_CLIENT_EMAIL");
    // Um documento que não existe: prova que a credencial lê o Firestore sem
    // trazer dado de ninguém, e custa uma leitura.
    await adminDb.collection("health").doc("ping").get();
  },
  async multicriteria() {
    requireEnv("API_BASE_URL");
    const baseUrl = process.env.API_BASE_URL!.replace(/\/+$/, "");
    // A lista de critérios responde 503 enquanto a planilha não carregou, então
    // além de o backend estar de pé ela prova que ele tem os dados.
    const response = await fetch(`${baseUrl}/api/v1/criterias`, {
      cache: "no-store",
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
    });
    await response.body?.cancel();
    if (!response.ok) throw new HttpStatusError(response.status);
  },
  async smtp() {
    if (!isMailerConfigured()) {
      throw new NotConfiguredError("Faltam SMTP_USER e SMTP_PASSWORD");
    }
    if (smtpOkUntil > Date.now()) return;
    await verifyMailer();
    smtpOkUntil = Date.now() + SMTP_OK_TTL_MS;
  },
};

let smtpOkUntil = 0;
let contentfulOkUntil = 0;
let cachedReport: { report: HealthReport; expiresAt: number } | null = null;
let pendingReport: Promise<HealthReport> | null = null;
const lastOk = new Map<DependencyName, boolean>();

function describeFailure(error: unknown) {
  if (error instanceof NotConfiguredError) return "not configured";
  if (error instanceof TimeoutError) return "timeout";
  if (error instanceof HttpStatusError) return error.message;
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === "number") return `HTTP ${status}`;
  return "failed";
}

function withTimeout(run: () => Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new TimeoutError()),
      HEALTH_CHECK_TIMEOUT_MS,
    );
  });
  return Promise.race([run(), timeout]).finally(() => clearTimeout(timer));
}

async function checkDependency(
  name: DependencyName,
): Promise<DependencyStatus> {
  const startedAt = Date.now();
  try {
    await withTimeout(CHECKS[name]);
    if (lastOk.get(name) === false) {
      console.info(`[health] ${name} voltou a responder`);
    }
    lastOk.set(name, true);
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    // Uma linha por queda, e não uma a cada verificação: com o monitor
    // chamando a cada minuto, uma dependência fora por horas afogaria o log.
    if (lastOk.get(name) !== false) {
      console.error(`[health] ${name} falhou:`, error);
    }
    lastOk.set(name, false);
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: describeFailure(error),
    };
  }
}

async function runChecks(): Promise<HealthReport> {
  const names = Object.keys(CHECKS) as DependencyName[];
  const results = await Promise.all(names.map(checkDependency));
  const dependencies = Object.fromEntries(
    names.map((name, index) => [name, results[index]]),
  ) as Record<DependencyName, DependencyStatus>;

  return {
    status: results.every((result) => result.ok) ? "ok" : "fail",
    checkedAt: new Date().toISOString(),
    dependencies,
  };
}

/**
 * O estado de cada dependência, reaproveitando a última verificação enquanto
 * ela vale; pedidos simultâneos dividem a mesma verificação em andamento.
 */
export function getHealthReport(): Promise<HealthReport> {
  if (cachedReport && cachedReport.expiresAt > Date.now()) {
    return Promise.resolve(cachedReport.report);
  }

  pendingReport ??= runChecks()
    .then((report) => {
      cachedReport = { report, expiresAt: Date.now() + HEALTH_REPORT_TTL_MS };
      return report;
    })
    .finally(() => {
      pendingReport = null;
    });

  return pendingReport;
}

/** Existe para o teste começar cada caso sem verificação guardada. */
export function resetHealthChecks() {
  smtpOkUntil = 0;
  contentfulOkUntil = 0;
  cachedReport = null;
  pendingReport = null;
  lastOk.clear();
}
