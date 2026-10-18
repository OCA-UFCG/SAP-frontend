import { cookies } from "next/headers";
import { redirect } from "@/translations/routing";
import {
  SESSION_COOKIE_NAME,
  getAuthenticatedSessionFromCookie,
} from "@/lib/server-session";
import { canDeleteOwnAccount } from "@/lib/account-deletion-policy";
import { DeleteAccountClient } from "./DeleteAccountClient";

/**
 * Onde a pessoa exclui a própria conta. A regra de quem pode (só contas que
 * vieram do cadastro) é a mesma da rota, e a rota confere de novo: a página só
 * decide o que mostrar.
 */
export default async function DeleteAccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = await getAuthenticatedSessionFromCookie(sessionCookie);

  if (!session?.email) {
    return redirect({ href: "/login", locale });
  }

  return (
    <DeleteAccountClient
      email={session.email}
      canDelete={canDeleteOwnAccount(session.access)}
    />
  );
}
