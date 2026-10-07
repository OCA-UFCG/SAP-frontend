"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import ResetPassword, {
  type ResetPasswordStatus,
} from "@/components/PasswordReset/ResetPassword";
import PlatformLoading from "@/app/[locale]/platform/loading";

type ResetPasswordPageClientProps = {
  backgroundImageUrl?: string;
};

type FailureReason = "invalid-code" | "weak-password" | "failed";

async function post(path: string, body: Record<string, string>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as {
    email?: string;
    reason?: FailureReason;
  } | null;

  return { ok: response.ok, payload };
}

export function ResetPasswordPageClient({
  backgroundImageUrl,
}: ResetPasswordPageClientProps) {
  const t = useTranslations("ResetPassword");
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";

  const [status, setStatus] = useState<ResetPasswordStatus | "checking">(
    "checking",
  );
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  // Confere o link ao abrir: um link vencido aparece como tal antes de a
  // pessoa digitar a senha nova duas vezes.
  useEffect(() => {
    let active = true;

    async function check() {
      if (!code) {
        setStatus("invalid");
        return;
      }

      try {
        const { ok, payload } = await post("/api/password-reset/check", {
          code,
        });

        if (!active) return;

        if (ok && payload?.email) {
          setEmail(payload.email);
          setStatus("ready");
          return;
        }

        // Só o servidor dizendo que o código não vale leva ao "link vencido".
        // Limite de tentativas ou falha do Firebase não dizem nada sobre o
        // link, e mandar pedir outro seria mandar a pessoa embora à toa.
        setStatus(payload?.reason === "invalid-code" ? "invalid" : "ready");
      } catch {
        // Sem rede não dá para saber se o link vale. Mostrar o formulário deixa
        // a pessoa tentar; o envio responde de verdade.
        if (active) setStatus("ready");
      }
    }

    void check();

    return () => {
      active = false;
    };
  }, [code]);

  const handleSubmit = useCallback(
    async (password: string) => {
      setError("");

      try {
        const { ok, payload } = await post("/api/password-reset/confirm", {
          code,
          password,
        });

        if (ok) {
          setStatus("done");
          return;
        }

        if (payload?.reason === "invalid-code") {
          setStatus("invalid");
          return;
        }

        setError(
          payload?.reason === "weak-password"
            ? t("weakPassword")
            : t("genericError"),
        );
      } catch {
        setError(t("genericError"));
      }
    },
    [code, t],
  );

  if (status === "checking") {
    return (
      <main className="flex min-h-[calc(100vh-4.125rem)] w-full">
        <PlatformLoading />
      </main>
    );
  }

  return (
    <ResetPassword
      status={status}
      email={email}
      error={error}
      backgroundImageUrl={backgroundImageUrl}
      onSubmit={handleSubmit}
    />
  );
}

export default ResetPasswordPageClient;
