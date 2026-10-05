"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Link } from "@/translations/routing";
import { LOGIN_PATH } from "@/config/accessRoutes";
import { LoginField } from "../Login/LoginField";
import {
  ERROR_ALERT,
  PRIMARY_BUTTON,
  PasswordResetLayout,
  SECONDARY_BUTTON,
  TEXT_LINK,
} from "./PasswordResetLayout";

type ForgotPasswordFormValues = {
  email: string;
};

type ForgotPasswordProps = {
  onSubmit?: (email: string) => void | Promise<void>;
  /** Pede o link de novo para o endereço já enviado. */
  onResend?: () => void | Promise<void>;
  backgroundImageUrl?: string;
  error?: string;
  /** O endereço para onde o link foi pedido. Presente, a tela vira o aviso. */
  submittedEmail?: string;
};

export const ForgotPassword = ({
  onSubmit,
  onResend,
  backgroundImageUrl,
  error,
  submittedEmail,
}: ForgotPasswordProps) => {
  const t = useTranslations("ForgotPassword");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({ defaultValues: { email: "" } });

  const submitEmail = handleSubmit(async ({ email }) => {
    await onSubmit?.(email.trim());
  });

  async function handleResend() {
    setResending(true);
    try {
      await onResend?.();
    } finally {
      setResending(false);
      setResent(true);
    }
  }

  const backToLogin = (
    <Link href={LOGIN_PATH} className={TEXT_LINK}>
      {t("backToLogin")}
    </Link>
  );

  if (submittedEmail) {
    return (
      <PasswordResetLayout
        backgroundImageUrl={backgroundImageUrl}
        logoAlt={t("logoAlt")}
        title={t("sentTitle")}
      >
        {/* A mesma frase com ou sem conta: dizer "não achamos esse
            e-mail" revelaria quem é usuário da plataforma. */}
        <p className="w-full text-[13px] leading-5 text-[#676264]">
          {t("sentDescription", { email: submittedEmail })}
        </p>

        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={resending}
            className={SECONDARY_BUTTON}
          >
            {resending ? t("resending") : t("resend")}
          </button>
          {resent ? (
            <p role="status" className="text-[12px] leading-4 text-[#676264]">
              {t("resent")}
            </p>
          ) : null}
        </div>

        {backToLogin}
      </PasswordResetLayout>
    );
  }

  return (
    <PasswordResetLayout
      backgroundImageUrl={backgroundImageUrl}
      logoAlt={t("logoAlt")}
      title={t("title")}
    >
      <form
        className="flex w-full flex-col items-center gap-[23px]"
        onSubmit={submitEmail}
        noValidate
      >
        <div className="flex w-full flex-col gap-4">
          <p className="text-[13px] leading-5 text-[#676264]">
            {t("description")}
          </p>

          {error ? (
            <p role="alert" className={ERROR_ALERT}>
              {error}
            </p>
          ) : null}

          <LoginField
            id="email"
            type="text"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            registration={register("email", {
              required: t("emailRequired"),
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: t("emailInvalid"),
              },
            })}
            errorMessage={errors.email?.message}
          />
        </div>

        <button type="submit" disabled={isSubmitting} className={PRIMARY_BUTTON}>
          {isSubmitting ? t("submitting") : t("submit")}
        </button>

        {backToLogin}
      </form>
    </PasswordResetLayout>
  );
};

export default ForgotPassword;
