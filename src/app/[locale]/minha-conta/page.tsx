import { cookies } from "next/headers";
import { redirect } from "@/translations/routing";
import {
  SESSION_COOKIE_NAME,
  getAuthenticatedSessionFromCookie,
} from "@/lib/server-session";
import { canDeleteOwnAccount } from "@/lib/account-deletion-policy";
import { MyAccountClient } from "./MyAccountClient";
import { pageTitleMetadata } from "@/lib/page-metadata";

export const generateMetadata = pageTitleMetadata("myAccount");

/**
 * A conta de quem está logado; é daqui que a pessoa exclui a própria conta. A
 * regra de quem pode (só contas que vieram do cadastro) é a mesma da rota, e a
 * rota confere de novo: a página só decide o que mostrar.
 */
export default async function MyAccountPage({
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
    <MyAccountClient
      email={session.email}
      canDelete={canDeleteOwnAccount(session.access)}
    />
  );
}
