"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/translations/routing";
import { MIN_PASSWORD_LENGTH } from "@/config/passwordRules";
import { VERIFICATION_EMAIL_COOLDOWN_SECONDS } from "@/config/verificationEmailCooldown";
import { formatCountdown, useCountdown } from "@/hooks/useCountdown";
import type { ResendOutcome } from "@/lib/verification-resend";
import { Icon } from "../Icon/Icon";
import { LoginField } from "../Login/LoginField";
import { LoginPhotoPanel } from "../Login/LoginPhotoPanel";
import { Captcha } from "../Captcha/Captcha";

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
  captchaToken: string;
};

type SignupProps = {
  onSubmit?: (values: SignupSubmitValues) => void | Promise<void>;
  /**
   * Reenvia o e-mail de confirmação. Precisa existir sempre: o link expira e o
   * envio pode falhar, e sem esta porta a única saída de quem não recebeu é
   * abrir chamado com a equipe.
   *
   * Devolve a recusa do servidor — captcha ou espera —, para a tela não dizer
   * que enviou um e-mail que não saiu.
   */
  onResend?: (
    captchaToken: string,
  ) => ResendOutcome | void | Promise<ResendOutcome | void>;
  backgroundImageUrl?: string;
  error?: string;
  submitted?: boolean;
};

const BELOW_HEADER = "min-h-[calc(100vh-4.125rem)]";

export const Signup = ({
  onSubmit,
  onResend,
  backgroundImageUrl,
  error,
  submitted = false,
}: SignupProps) => {
  const t = useTranslations("Signup");
  const tCaptcha = useTranslations("Captcha");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendRefused, setResendRefused] = useState(false);
  const [resendTooSoon, setResendTooSoon] = useState(false);
  // O Firebase recusa um link novo antes de um minuto, e cada link novo anula o
  // anterior. O botão espera o mesmo que o servidor, contando do último envio.
  const [resendWait, startResendWait] = useCountdown();
  // O token só vale uma vez. Cada tentativa troca a `key` do widget, que então
  // resolve um token novo.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const [resendToken, setResendToken] = useState<string | null>(null);
  const [resendAttempt, setResendAttempt] = useState(0);

  async function handleResend() {
    if (!resendToken) return;

    setResending(true);
    try {
      const outcome = (await onResend?.(resendToken)) ?? { status: "sent" };
      setResendRefused(outcome.status === "captcha");
      setResendTooSoon(outcome.status === "wait");
      setResent(outcome.status === "sent");

      if (outcome.status === "sent") {
        startResendWait(VERIFICATION_EMAIL_COOLDOWN_SECONDS);
      } else if (outcome.status === "wait") {
        startResendWait(outcome.seconds);
      }
    } finally {
      setResending(false);
      setResendToken(null);
      setResendAttempt((attempt) => attempt + 1);
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
    if (!captchaToken) return;

    // A intenção vai sempre. O servidor é quem decide se ela era necessária —
    // ele recalcula o domínio e ignora o campo no trilho institucional. Deixar
    // a decisão lá remove a corrida entre o clique e a resposta da consulta de
    // domínio, que antes fazia a pessoa receber um erro sobre um campo que só
    // apareceu depois do clique.
    await onSubmit?.({
      email: values.email,
      password: values.password,
      intention: values.intention,
      captchaToken,
    });

    // O cadastro já mandou o primeiro e-mail. Se ele falhou, o formulário
    // continua na tela e a espera não aparece.
    startResendWait(VERIFICATION_EMAIL_COOLDOWN_SECONDS);
    setCaptchaToken(null);
    setCaptchaAttempt((attempt) => attempt + 1);
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
              width={136}
              height={46}
              priority
              className="h-[110px] w-auto"
            />
            <h1 className="font-inter w-full text-[1.5rem] font-medium leading-7 tracking-[-0.36px] text-[#50554C]">
              {t("successTitle")}
            </h1>
            <p className="w-full text-[0.8125rem] leading-5 text-[#676264]">
              {t("successDescription")}
            </p>

            <div className="flex w-full flex-col gap-2">
              <Captcha
                key={`resend-${resendAttempt}`}
                action="resend"
                onToken={setResendToken}
              />
              <button
                type="button"
                onClick={() => void handleResend()}
                disabled={resending || !resendToken || resendWait > 0}
                className="font-open-sans flex h-[33px] w-full cursor-pointer items-center justify-center rounded-md border border-[#DBE0CC] px-3 py-1.5 text-[0.7281rem] leading-5 text-[#50554C] transition hover:bg-[#F3F5EE] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B612A] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {resending
                  ? t("resending")
                  : resendWait > 0
                    ? t("resendIn", { time: formatCountdown(resendWait) })
                    : t("resend")}
              </button>
              {resent ? (
                <p role="status" className="text-[0.75rem] leading-4 text-[#676264]">
                  {t("resent")}
                </p>
              ) : null}
              {resendTooSoon ? (
                <p role="status" className="text-[0.75rem] leading-4 text-[#676264]">
                  {t("resendTooSoon")}
                </p>
              ) : null}
              {resendRefused ? (
                <p role="alert" className="text-[0.75rem] leading-4 text-[#B3261E]">
                  {tCaptcha("failed")}
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
                  width={136}
                  height={46}
                  priority
                  className="h-[110px] w-auto"
                />
                <h1 className="font-inter w-full text-[1.5rem] font-medium leading-5 tracking-[-0.36px] text-[#50554C]">
                  {t("title")}
                </h1>
              </div>

              <div className="flex w-full flex-col gap-4">
                {error ? (
                  <p
                    role="alert"
                    className="rounded-[7px] bg-[#FCE8E6] px-2.5 py-2 text-[0.8125rem] leading-5 text-[#B3261E]"
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
                      className="flex cursor-pointer items-center -m-2 rounded-sm p-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#646B2D]"
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
                      className="font-inter w-full resize-y rounded-[7px] bg-[#E4E5E2] px-2.5 py-2 text-[0.8125rem] font-medium leading-5 tracking-[-0.2px] text-[#292829] outline-none transition placeholder:text-[#676264] focus:ring-2 focus:ring-[#646B2D] aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-[#B3261E]"
                      {...register("intention", {
                        required: t("intentionRequired"),
                      })}
                    />
                    {errors.intention ? (
                      <p
                        id="intention-error"
                        className="text-[0.75rem] leading-4 text-[#B3261E]"
                      >
                        {errors.intention.message}
                      </p>
                    ) : (
                      <p
                        id="intention-hint"
                        className="text-[0.75rem] leading-4 text-[#676264]"
                      >
                        {t("intentionHint")}
                      </p>
                    )}
                  </div>
                }
              </div>
            </div>

            <Captcha
              key={`signup-${captchaAttempt}`}
              action="signup"
              onToken={setCaptchaToken}
            />

            <button
              type="submit"
              disabled={isSubmitting || !captchaToken}
              className="font-open-sans flex h-[33px] w-full cursor-pointer items-center justify-center rounded-md bg-[#646B2D] px-3 py-1.5 text-[0.7281rem] leading-5 text-white transition hover:bg-[#4F5424] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B612A] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? t("submitting") : t("submit")}
            </button>

            <p className="text-[0.75rem] leading-4 text-[#676264]">
              {t("hasAccount")}{" "}
              <Link
                href="/login"
                className="font-medium text-[#5B612A] underline underline-offset-2 hover:text-[#21240F]"
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
