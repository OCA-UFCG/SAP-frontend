import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  verifyFirebaseSessionCookie,
} from "@/lib/server-session";
import PlatformLoading from "./loading";

/**
 * Confere a sessão antes de entregar qualquer página da plataforma. Fica atrás
 * de um `Suspense` para que a tela de carregamento saia antes da ida ao
 * Firebase (~330 ms quando a sessão não está no cache): sem isso a pessoa
 * clicava em "Plataforma" e via a página antiga parada até a verificação
 * terminar. Nenhum conteúdo sai antes disso, porque `children` só é devolvido
 * depois que a verificação passa.
 *
 * <PlatformSessionGate sessionCookie={cookie}>{children}</PlatformSessionGate>
 */
async function PlatformSessionGate({
  sessionCookie,
  children,
}: {
  sessionCookie: string;
  children: React.ReactNode;
}) {
  const isAuthenticated = await verifyFirebaseSessionCookie(sessionCookie);

  if (!isAuthenticated) {
    redirect("/login");
  }

  return <>{children}</>;
}

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  // Sem cookie não há o que verificar: redireciona antes de começar a enviar a
  // tela de carregamento, mantendo o redirecionamento HTTP para quem não entrou.
  if (!sessionCookie) {
    redirect("/login");
  }

  return (
    <Suspense fallback={<PlatformLoading />}>
      <PlatformSessionGate sessionCookie={sessionCookie}>
        {children}
      </PlatformSessionGate>
    </Suspense>
  );
}
