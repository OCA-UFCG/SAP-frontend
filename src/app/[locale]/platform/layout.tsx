import { Suspense } from "react";
import { redirect } from "@/translations/routing";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/server-session";
import { resolvePlatformAccess } from "@/lib/platform-access";
import { isPlatformOpen } from "@/lib/access-flag";
import { LOGIN_PATH, PENDING_APPROVAL_PATH } from "@/config/accessRoutes";
import PlatformLoading from "./loading";
import { PlatformIntro } from "@/components/PlatformIntro/PlatformIntro";
import { PLATFORM_INTRO_COOKIE } from "@/components/PlatformIntro/platformIntroState";

/**
 * Confere a sessão antes de entregar qualquer página da plataforma. Fica atrás
 * de um `Suspense` para que a tela de carregamento saia antes da ida ao
 * Firebase (~330 ms quando a sessão não está no cache): sem isso a pessoa
 * clicava em "Plataforma" e via a página antiga parada até a verificação
 * terminar. Nenhum conteúdo sai antes disso, porque `children` só é devolvido
 * depois que a verificação passa.
 *
 * <PlatformSessionGate sessionCookie={cookie} locale="pt">{children}</PlatformSessionGate>
 */
async function PlatformSessionGate({
  sessionCookie,
  locale,
  children,
}: {
  sessionCookie: string;
  locale: string;
  children: React.ReactNode;
}) {
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

export default async function PlatformLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const cookieStore = await cookies();

  // Fica no layout, e não na página, para cobrir também a tela de carregamento.
  // Por cima de tudo, a abertura não muda o resto da árvore.
  const intro = cookieStore.has(PLATFORM_INTRO_COOKIE) ? null : (
    <PlatformIntro />
  );

  // Plataforma aberta: sem conferência de sessão. As telas só da equipe
  // (auditoria, catálogo, aprovações) conferem o login por conta própria.
  if (isPlatformOpen()) {
    return (
      <>
        {intro}
        {children}
      </>
    );
  }

  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  // Sem cookie não há o que verificar: redireciona antes de começar a enviar a
  // tela de carregamento, mantendo o redirecionamento HTTP para quem não entrou.
  if (!sessionCookie) {
    return redirect({ href: LOGIN_PATH, locale });
  }

  return (
    <>
      {intro}
      <Suspense fallback={<PlatformLoading />}>
        <PlatformSessionGate sessionCookie={sessionCookie} locale={locale}>
          {children}
        </PlatformSessionGate>
      </Suspense>
    </>
  );
}
