"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Signup, { type SignupSubmitValues } from "@/components/Signup/Signup";
import { requestVerificationResend } from "@/lib/verification-resend";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "@/translations/routing";
import {
  ACCESS_REVOKED_PARAM,
  PENDING_APPROVAL_PATH,
  PLATFORM_PATH,
} from "@/config/accessRoutes";
import {
  announceSignupEntered,
  watchSignupConfirmation,
} from "@/lib/signup-auto-entry";

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
  // Só na memória desta aba, para entrar sozinha quando o e-mail for
  // confirmado. É esquecida quando a espera acaba.
  const credentials = useRef<{ email: string; password: string } | null>(null);
  const { signIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!submitted || !credentials.current) return;

    const { email, password } = credentials.current;

    return watchSignupConfirmation({
      email,
      password,
      onExpire: () => {
        credentials.current = null;
      },
      onConfirmed: async () => {
        credentials.current = null;
        const outcome = await signIn(email, password);

        if (outcome === "ok") {
          announceSignupEntered();
          router.replace(PLATFORM_PATH);
          router.refresh();
        } else if (outcome === "pending") {
          router.replace(PENDING_APPROVAL_PATH);
        } else if (outcome === "revoked") {
          router.replace(`${PENDING_APPROVAL_PATH}?${ACCESS_REVOKED_PARAM}=1`);
        }
      },
    });
  }, [submitted, signIn, router]);

  const handleResend = useCallback(
    async (captchaToken: string) => {
      if (!submittedEmail) return;

      return requestVerificationResend(submittedEmail, captchaToken, locale);
    },
    [submittedEmail, locale],
  );

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
            code?: string;
          } | null;
          // O servidor manda um código; a mensagem sai no idioma da página.
          const errorKey = `errors.${body?.code}`;

          setError(body?.code && t.has(errorKey) ? t(errorKey) : t("genericError"));
          return;
        }

        credentials.current = {
          email: values.email,
          password: values.password,
        };
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
