"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/translations/routing";
import { Icon } from "../Icon/Icon";
import { LoginField } from "../Login/LoginField";
import { LoginPhotoPanel } from "../Login/LoginPhotoPanel";

export type SignupFormValues = {
  email: string;
  password: string;
  confirmPassword: string;
  intention: string;
};

export type SignupSubmitValues = {
  email: string;
  password: string;
  intention: string;
};

type SignupProps = {
  onSubmit?: (values: SignupSubmitValues) => void | Promise<void>;
  /**
   * Reenvia o e-mail de confirmação. Precisa existir sempre: o link expira e o
   * envio pode falhar, e sem esta porta a única saída de quem não recebeu é
   * abrir chamado com a equipe.
   */
  onResend?: () => void | Promise<void>;
  backgroundImageUrl?: string;
  error?: string;
  submitted?: boolean;
};

const BELOW_HEADER = "min-h-[calc(100vh-4.125rem)]";
const MIN_PASSWORD_LENGTH = 8;

export const Signup = ({
  onSubmit,
  onResend,
  backgroundImageUrl,
  error,
  submitted = false,
}: SignupProps) => {
  const t = useTranslations("Signup");
  const [passwordVisible, setPasswordVisible] = useState(false);
  // A consulta de domínio em andamento, se houver. O envio espera por ela: sem
  // isso, quem digitava o e-mail e clicava direto enviava antes de o campo de
  // intenção existir, e recebia um erro sobre um campo que só apareceu depois
  // do clique.
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleResend() {
    setResending(true);
    try {
      await onResend?.();
    } finally {
      setResending(false);
      setResent(true);
    }
  }

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      intention: "",
    },
  });

  const submitSignup = handleSubmit(async (values) => {
    // A intenção vai sempre. O servidor é quem decide se ela era necessária —
    // ele recalcula o domínio e ignora o campo no trilho institucional. Deixar
    // a decisão lá remove a corrida entre o clique e a resposta da consulta de
    // domínio, que antes fazia a pessoa receber um erro sobre um campo que só
    // apareceu depois do clique.
    await onSubmit?.({
      email: values.email,
      password: values.password,
      intention: values.intention,
    });
  });


  const toggleLabel = passwordVisible ? t("hidePassword") : t("showPassword");
  const emailRegistration = register("email", {
    required: t("emailRequired"),
    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: t("emailInvalid") },
  });

  return (
    <section className={`flex w-full items-stretch ${BELOW_HEADER}`}>
      <LoginPhotoPanel photoUrl={backgroundImageUrl} />

      <div className="flex w-full shrink-0 items-center justify-center bg-white px-[42px] py-16 lg:w-[495px] lg:border-l-4 lg:border-solid lg:border-[#EFEFEF]">
        {submitted ? (
          <div className="flex w-[342px] max-w-full flex-col items-center gap-6">
            <Image
              src="/green-sedes-logo.svg"
              alt={t("logoAlt")}
              width={128}
              height={46}
              priority
              className="h-[110px] w-auto"
            />
            <h1 className="font-inter w-full text-[24px] font-medium leading-7 tracking-[-0.36px] text-[#50554C]">
              {t("successTitle")}
            </h1>
            <p className="w-full text-[13px] leading-5 text-[#676264]">
              {t("successDescription")}
            </p>

            <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                onClick={() => void handleResend()}
                disabled={resending}
                className="font-open-sans flex h-[33px] w-full cursor-pointer items-center justify-center rounded-md border border-[#DBE0CC] px-3 py-1.5 text-[11.65px] leading-5 text-[#50554C] transition hover:bg-[#F3F5EE] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#777E32] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {resending ? t("resending") : t("resend")}
              </button>
              {resent ? (
                <p role="status" className="text-[12px] leading-4 text-[#676264]">
                  {t("resent")}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <form
            className="flex w-[342px] max-w-full flex-col items-center gap-[23px]"
            onSubmit={submitSignup}
            noValidate
          >
            <div className="flex w-full flex-col gap-6">
              <div className="flex w-full flex-col items-center gap-16">
                <Image
                  src="/green-sedes-logo.svg"
                  alt={t("logoAlt")}
                  width={128}
                  height={46}
                  priority
                  className="h-[110px] w-auto"
                />
                <h1 className="font-inter w-full text-[24px] font-medium leading-5 tracking-[-0.36px] text-[#50554C]">
                  {t("title")}
                </h1>
              </div>

              <div className="flex w-full flex-col gap-4">
                {error ? (
                  <p
                    role="alert"
                    className="rounded-[7px] bg-[#FCE8E6] px-2.5 py-2 text-[13px] leading-5 text-[#B3261E]"
                  >
                    {error}
                  </p>
                ) : null}

                <LoginField
                  id="email"
                  type="text"
                  autoComplete="email"
                  placeholder={t("emailPlaceholder")}
                  registration={emailRegistration}
                  errorMessage={errors.email?.message}
                />

                <LoginField
                  id="password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder={t("passwordPlaceholder")}
                  registration={register("password", {
                    required: t("passwordRequired"),
                    minLength: {
                      value: MIN_PASSWORD_LENGTH,
                      message: t("passwordTooShort"),
                    },
                  })}
                  errorMessage={errors.password?.message}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setPasswordVisible((visible) => !visible)}
                      aria-label={toggleLabel}
                      aria-pressed={passwordVisible}
                      aria-controls="password"
                      className="flex cursor-pointer items-center rounded-sm p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#989F43]"
                    >
                      <Icon
                        id="eye"
                        width={20}
                        height={14}
                        aria-hidden
                        className={
                          passwordVisible ? "text-[#50554C]" : "text-[#676264]"
                        }
                      />
                    </button>
                  }
                />

                <LoginField
                  id="confirmPassword"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder={t("confirmPasswordPlaceholder")}
                  registration={register("confirmPassword", {
                    required: t("confirmPasswordRequired"),
                    validate: (value) =>
                      value === getValues("password") || t("passwordMismatch"),
                  })}
                  errorMessage={errors.confirmPassword?.message}
                />

                {
                  <div className="flex w-full flex-col gap-1">
                    <textarea
                      id="intention"
                      rows={4}
                      maxLength={1000}
                      placeholder={t("intentionPlaceholder")}
                      aria-label={t("intentionPlaceholder")}
                      aria-invalid={Boolean(errors.intention)}
                      aria-describedby={
                        errors.intention ? "intention-error" : "intention-hint"
                      }
                      className="font-inter w-full resize-y rounded-[7px] bg-[#E4E5E2] px-2.5 py-2 text-[13px] font-medium leading-5 tracking-[-0.2px] text-[#292829] outline-none transition placeholder:text-[#676264] focus:ring-2 focus:ring-[#989F43] aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-[#B3261E]"
                      {...register("intention", {
                        required: t("intentionRequired"),
                      })}
                    />
                    {errors.intention ? (
                      <p
                        id="intention-error"
                        className="text-[12px] leading-4 text-[#B3261E]"
                      >
                        {errors.intention.message}
                      </p>
                    ) : (
                      <p
                        id="intention-hint"
                        className="text-[12px] leading-4 text-[#676264]"
                      >
                        {t("intentionHint")}
                      </p>
                    )}
                  </div>
                }
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="font-open-sans flex h-[33px] w-full cursor-pointer items-center justify-center rounded-md bg-[#989F43] px-3 py-1.5 text-[11.65px] leading-5 text-white transition hover:bg-[#5B612A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#777E32] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? t("submitting") : t("submit")}
            </button>

            <p className="text-[12px] leading-4 text-[#676264]">
              {t("hasAccount")}{" "}
              <Link
                href="/login"
                className="font-medium text-[#777E32] underline underline-offset-2 hover:text-[#5B612A]"
              >
                {t("signIn")}
              </Link>
            </p>
          </form>
        )}
      </div>
    </section>
  );
};

export default Signup;
