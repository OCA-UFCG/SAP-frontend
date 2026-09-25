import { redirect } from "@/translations/routing";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/server-session";
import { resolvePlatformAccess } from "@/lib/platform-access";
import { LOGIN_PATH, PENDING_APPROVAL_PATH } from "@/config/accessRoutes";

export default async function PlatformLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const access = await resolvePlatformAccess(sessionCookie);

  // O redirect vem de `@/translations/routing`, não de `next/navigation`: o
  // projeto usa prefixo de idioma sempre, e o de baixo nível manda para o
  // idioma padrão. Quem navegava em /en caía numa página em português.
  if (access === "unauthenticated") {
    redirect({ href: LOGIN_PATH, locale });
  }

  if (access === "unapproved") {
    redirect({ href: PENDING_APPROVAL_PATH, locale });
  }

  return <>{children}</>;
}
