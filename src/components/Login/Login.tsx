"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Icon } from "../Icon/Icon";
import { LoginField } from "./LoginField";
import { LoginPhotoPanel } from "./LoginPhotoPanel";

export type LoginFormValues = {
  login: string;
  password: string;
};

type LoginProps = {
  onSubmit?: (values: LoginFormValues) => void | Promise<void>;
  backgroundImageUrl?: string;
  error?: string;
};

const BELOW_HEADER = "min-h-[calc(100vh-4.125rem)]";

export const Login = ({ onSubmit, backgroundImageUrl, error }: LoginProps) => {
  const t = useTranslations("Login");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: {
      login: "",
      password: "",
    },
  });

  const submitLogin = handleSubmit(async (values) => {
    await onSubmit?.(values);
  });

  const toggleLabel = passwordVisible ? t("hidePassword") : t("showPassword");

  return (
    <section className={`flex w-full items-stretch ${BELOW_HEADER}`}>
      <LoginPhotoPanel photoUrl={backgroundImageUrl} />

      <div className="flex w-full shrink-0 items-center justify-center bg-white px-[42px] py-16 lg:w-[495px] lg:border-l-4 lg:border-solid lg:border-[#EFEFEF]">
        <form
          className="flex w-[342px] max-w-full flex-col items-center gap-[23px]"
          onSubmit={submitLogin}
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
                id="login"
                type="text"
                autoComplete="username"
                placeholder={t("emailPlaceholder")}
                registration={register("login", {
                  required: t("emailRequired"),
                })}
                errorMessage={errors.login?.message}
              />

              <LoginField
                id="password"
                type={passwordVisible ? "text" : "password"}
                autoComplete="current-password"
                placeholder={t("passwordPlaceholder")}
                registration={register("password", {
                  required: t("passwordRequired"),
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
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="font-open-sans flex h-[33px] w-full cursor-pointer items-center justify-center rounded-md bg-[#989F43] px-3 py-1.5 text-[11.65px] leading-5 text-white transition hover:bg-[#5B612A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#777E32] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? t("submitting") : t("submit")}
          </button>
        </form>
      </div>
    </section>
  );
};

export default Login;
