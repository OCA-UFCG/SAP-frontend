"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Login, { type LoginFormValues } from "@/components/Login/Login";

type LoginPageClientProps = {
  backgroundImageUrl?: string;
};

export function getPlatformRedirectPath(redirect: string | null) {
  if (!redirect) return "/platform";
  if (redirect === "/platform" || redirect.startsWith("/platform/")) {
    return redirect;
  }

  return "/platform";
}

export function LoginPageClient({ backgroundImageUrl }: LoginPageClientProps) {
  const { signIn, loading, error } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(values: LoginFormValues) {
    const success = await signIn(values.login, values.password);
    if (!success) return;

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
      error={error}
      onSubmit={handleSubmit}
    />
  );
}
