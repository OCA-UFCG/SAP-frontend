"use client";

import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import ForgotPassword from "@/components/PasswordReset/ForgotPassword";

type ForgotPasswordPageClientProps = {
  backgroundImageUrl?: string;
};

export function ForgotPasswordPageClient({
  backgroundImageUrl,
}: ForgotPasswordPageClientProps) {
  const t = useTranslations("ForgotPassword");
  // O e-mail sai no idioma em que a pessoa pediu, e o link volta para ele.
  const locale = useLocale();
  const [error, setError] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");

  const requestLink = useCallback(
    (email: string) =>
      fetch("/api/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      }),
    [locale],
  );

  const handleSubmit = useCallback(
    async (email: string) => {
      setError("");

      try {
        const response = await requestLink(email);

        // Só limite de tentativas e origem recusada chegam aqui como erro: a
        // resposta normal é a mesma com ou sem conta.
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;

          setError(body?.error || t("genericError"));
          return;
        }

        setSubmittedEmail(email);
      } catch {
        setError(t("genericError"));
      }
    },
    [requestLink, t],
  );

  const handleResend = useCallback(async () => {
    if (!submittedEmail) return;

    // Mesma resposta genérica do primeiro envio; falhar em silêncio mostra o
    // mesmo aviso que o sucesso.
    await requestLink(submittedEmail).catch(() => undefined);
  }, [requestLink, submittedEmail]);

  return (
    <ForgotPassword
      backgroundImageUrl={backgroundImageUrl}
      error={error}
      submittedEmail={submittedEmail}
      onSubmit={handleSubmit}
      onResend={handleResend}
    />
  );
}

export default ForgotPasswordPageClient;
