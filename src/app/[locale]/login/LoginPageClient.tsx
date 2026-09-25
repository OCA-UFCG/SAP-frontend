"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "@/translations/routing";
import { useAuth } from "@/contexts/AuthContext";
import Login, { type LoginFormValues } from "@/components/Login/Login";
import { PENDING_APPROVAL_PATH } from "@/config/accessRoutes";

type LoginPageClientProps = {
  backgroundImageUrl?: string;
  signupOffered?: boolean;
};

export function getPlatformRedirectPath(redirect: string | null) {
  if (!redirect) return "/platform";
  if (redirect === "/platform" || redirect.startsWith("/platform/")) {
    return redirect;
  }

  return "/platform";
}

export function LoginPageClient({
  backgroundImageUrl,
  signupOffered,
}: LoginPageClientProps) {
  const { signIn, loading, error } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(values: LoginFormValues) {
    const outcome = await signIn(values.login, values.password);

    // Senha certa, acesso ainda não liberado: a pessoa vai para a página de
    // espera, não de volta ao formulário que ela acabou de preencher direito.
    if (outcome === "pending") {
      // `useRouter` vem de `@/translations/routing`: o de `next/navigation`
      // levaria a pessoa para a versão em português da página de espera,
      // qualquer que fosse o idioma em que ela se cadastrou.
      router.replace(PENDING_APPROVAL_PATH);
      return;
    }

    if (outcome !== "ok") return;

    router.replace(getPlatformRedirectPath(searchParams.get("redirect")));
    router.refresh();
  }

  return loading ? (
    <div className="flex min-h-screen items-center justify-center bg-[#4A4E26]">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-white" />
    </div>
  ) : (
    <Login
      backgroundImageUrl={backgroundImageUrl}
      signupOffered={signupOffered}
      error={error}
      onSubmit={handleSubmit}
    />
  );
}
