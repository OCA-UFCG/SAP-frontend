"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Login, { type LoginFormValues } from "@/components/Login/Login";

function LoginPageContent() {
  const { signIn, user, loading } = useAuth();
  const router = useRouter();
  const redirect = "/platform";

  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) {
      router.replace(redirect);
    }
  }, [user, loading, redirect, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#777E32]" />
      </div>
    );
  }

  if (user) return null;

  async function handleSubmit(values: LoginFormValues) {
    setError("");
    try {
      await signIn(values.login, values.password);
      router.push(redirect);
    } catch (err: unknown) {
      const fbErr = err as { code?: string; message?: string };
      const messages: Record<string, string> = {
        "auth/user-not-found": "Usuário não encontrado",
        "auth/wrong-password": "Senha incorreta",
        "auth/invalid-email": "Login inválido",
        "auth/invalid-credential": "Login ou senha inválidos",
        "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde",
      };
      setError(
        fbErr.code
          ? messages[fbErr.code] || "Erro ao fazer login"
          : "Erro ao fazer login",
      );
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      {error && (
        <div className="mb-4 w-full max-w-[424px] rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <Login onSubmit={handleSubmit} />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#777E32]" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
