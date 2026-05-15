"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Login, { type LoginFormValues } from "@/components/Login/Login";

type LoginPageClientProps = {
  backgroundImageUrl?: string;
};

export function LoginPageClient({ backgroundImageUrl }: LoginPageClientProps) {
  const { signIn, user, loading, error } = useAuth();
  const router = useRouter();
  const redirect = "/platform";

  if (!loading && user)
      router.replace(redirect);
  
  async function handleSubmit(values: LoginFormValues) {
    await signIn(values.login, values.password);
    if(!error && !loading && user) router.push(redirect);
  }

  return (
    loading ? (
      <div className="flex min-h-screen items-center justify-center bg-[#4A4E26]">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-white" />
      </div>
    ) : (
      <Login
        backgroundImageUrl={backgroundImageUrl}
        error={error}
        onSubmit={handleSubmit}
      />
    )
  )
}
