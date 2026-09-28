"use client";

import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Signup, { type SignupSubmitValues } from "@/components/Signup/Signup";

type SignupPageClientProps = {
  backgroundImageUrl?: string;
};

export function SignupPageClient({ backgroundImageUrl }: SignupPageClientProps) {
  const t = useTranslations("Signup");
  // Viaja com o cadastro para os e-mails saírem no idioma em que a pessoa se
  // inscreveu — inclusive o de decisão, que pode sair semanas depois.
  const locale = useLocale();
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  // Guardado só para o reenvio: o formulário já foi trocado pelo aviso quando o
  // botão aparece, então o valor não está mais em nenhum campo.
  const [submittedEmail, setSubmittedEmail] = useState("");

  const handleResend = useCallback(async () => {
    if (!submittedEmail) return;

    await fetch("/api/signup/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: submittedEmail }),
    }).catch(() => undefined);
  }, [submittedEmail]);

  const handleSubmit = useCallback(
    async (values: SignupSubmitValues) => {
      setError("");

      try {
        const response = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, locale }),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;

          setError(body?.error || t("genericError"));
          return;
        }

        setSubmittedEmail(values.email);
        setSubmitted(true);
      } catch {
        setError(t("genericError"));
      }
    },
    [t, locale],
  );

  return (
    <Signup
      backgroundImageUrl={backgroundImageUrl}
      error={error}
      submitted={submitted}
      onResend={handleResend}
      onSubmit={handleSubmit}
    />
  );
}

export default SignupPageClient;
