import { adminAuth } from "@/lib/firebase-admin";
import { readStoredAccess, type StoredAccess } from "@/lib/access-claims";
import {
  deleteAccessRequest,
  readAccessRequests,
} from "@/lib/access-requests";

/**
 * Quem tem — ou já teve — acesso à plataforma, para a tela de Aprovações.
 *
 * A lista sai das contas do Firebase, e não dos pedidos de cadastro, porque as
 * contas de antes do cadastro (liberadas pelo backfill) não têm pedido nenhum e
 * ficariam de fora. O projeto do Firebase é dividido com outros sistemas, então
 * só entra quem carrega a marca do SAP.
 */
export interface AccountWithAccess {
  uid: string;
  email: string;
  access: StoredAccess["access"];
  tier: StoredAccess["tier"];
  /** Quando o acesso foi liberado ou removido, em segundos. */
  at: number;
  intention: string;
}

const LIST_USERS_PAGE_SIZE = 1000;

export async function listAccountsWithAccess(): Promise<AccountWithAccess[]> {
  const accounts: Omit<AccountWithAccess, "intention">[] = [];
  let pageToken: string | undefined;

  do {
    const page = await adminAuth.listUsers(LIST_USERS_PAGE_SIZE, pageToken);

    for (const user of page.users) {
      const stored = readStoredAccess(user.customClaims);

      if (!stored || !user.email) continue;

      accounts.push({ uid: user.uid, email: user.email, ...stored });
    }

    pageToken = page.pageToken;
  } while (pageToken);

  const requests = await readAccessRequests(accounts.map(({ uid }) => uid));

  return accounts
    .map((account) => ({
      ...account,
      intention: requests.get(account.uid)?.intention ?? "",
    }))
    .sort((left, right) => left.email.localeCompare(right.email, "pt-BR"));
}

/**
 * Exclui uma conta e o que a plataforma guarda sobre ela.
 *
 * O registro do cadastro vai primeiro. Se a exclusão da conta falhar depois
 * dele, repetir resolve; na ordem inversa, uma falha deixaria o e-mail e a
 * intenção de uso guardados sem conta nenhuma a que pertencer, e ninguém
 * voltaria para apagá-los.
 *
 * Os eventos de uso não entram aqui porque não guardam mais quem é a pessoa
 * (ver `docs/telemetria.md`).
 */
export async function deleteAccount(uid: string) {
  await deleteAccessRequest(uid);
  await adminAuth.deleteUser(uid);
}

const SIGN_IN_URL =
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";

export type PasswordCheck = "ok" | "wrong" | "too-many-attempts" | "failed";

/**
 * Confere a senha de quem pediu para excluir a própria conta.
 *
 * Um cookie de sessão esquecido num computador compartilhado não pode bastar
 * para apagar a conta de alguém: pedir a senha de novo é o que garante que é a
 * própria pessoa. A senha é uma credencial e nada aqui a registra em log.
 */
export async function checkAccountPassword(
  uid: string,
  email: string,
  password: string,
): Promise<PasswordCheck> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!apiKey) {
    console.error(
      "Não dá para conferir a senha: NEXT_PUBLIC_FIREBASE_API_KEY não está configurada.",
    );
    return "failed";
  }

  try {
    const response = await fetch(
      `${SIGN_IN_URL}?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: false }),
      },
    );
    const body = (await response.json().catch(() => ({}))) as {
      localId?: string;
      error?: { message?: string };
    };

    if (response.ok) {
      return body.localId === uid ? "ok" : "wrong";
    }

    const message = body.error?.message ?? "";

    if (message.startsWith("TOO_MANY_ATTEMPTS_TRY_LATER")) {
      return "too-many-attempts";
    }

    if (
      message.startsWith("INVALID_PASSWORD") ||
      message.startsWith("INVALID_LOGIN_CREDENTIALS") ||
      message.startsWith("EMAIL_NOT_FOUND")
    ) {
      return "wrong";
    }

    console.error("Falha ao conferir a senha para excluir a conta.", message);
    return "failed";
  } catch (error) {
    console.error(
      "Falha ao conferir a senha para excluir a conta.",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    return "failed";
  }
}
