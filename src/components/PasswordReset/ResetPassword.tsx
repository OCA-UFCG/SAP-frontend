"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Link } from "@/translations/routing";
import { FORGOT_PASSWORD_PATH, LOGIN_PATH } from "@/config/accessRoutes";
import { MIN_PASSWORD_LENGTH } from "@/config/passwordRules";
import { Icon } from "../Icon/Icon";
import { LoginField } from "../Login/LoginField";
import {
  ERROR_ALERT,
  PRIMARY_BUTTON,
  PasswordResetLayout,
} from "./PasswordResetLayout";

type ResetPasswordFormValues = {
  password: string;
  confirmPassword: string;
};

export type ResetPasswordStatus = "ready" | "invalid" | "done";

type ResetPasswordProps = {
  status: ResetPasswordStatus;
  /** De quem é a conta, para a pessoa saber que abriu o link certo. */
  email?: string;
  onSubmit?: (password: string) => void | Promise<void>;
  backgroundImageUrl?: string;
  error?: string;
};

export const ResetPassword = ({
  status,
  email,
  onSubmit,
  backgroundImageUrl,
  error,
}: ResetPasswordProps) => {
  const t = useTranslations("ResetPassword");
  const [passwordVisible, setPasswordVisible] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    defaultValues: { password: "", confirmPassword: "" },
  });

  const submitPassword = handleSubmit(async ({ password }) => {
    await onSubmit?.(password);
  });

  if (status === "invalid") {
    return (
      <PasswordResetLayout
        backgroundImageUrl={backgroundImageUrl}
        logoAlt={t("logoAlt")}
        title={t("invalidTitle")}
      >
        <p className="w-full text-[13px] leading-5 text-[#676264]">
          {t("invalidBody")}
        </p>
        <Link href={FORGOT_PASSWORD_PATH} className={PRIMARY_BUTTON}>
          {t("requestNew")}
        </Link>
      </PasswordResetLayout>
    );
  }

  if (status === "done") {
    return (
      <PasswordResetLayout
        backgroundImageUrl={backgroundImageUrl}
        logoAlt={t("logoAlt")}
        title={t("doneTitle")}
      >
        <p className="w-full text-[13px] leading-5 text-[#676264]">
          {t("doneBody")}
        </p>
        <Link href={LOGIN_PATH} className={PRIMARY_BUTTON}>
          {t("enter")}
        </Link>
      </PasswordResetLayout>
    );
  }

  const toggleLabel = passwordVisible ? t("hidePassword") : t("showPassword");

  return (
    <PasswordResetLayout
      backgroundImageUrl={backgroundImageUrl}
      logoAlt={t("logoAlt")}
      title={t("title")}
    >
      <form
        className="flex w-full flex-col items-center gap-[23px]"
        onSubmit={submitPassword}
        noValidate
      >
        <div className="flex w-full flex-col gap-4">
          {email ? (
            <p className="text-[13px] leading-5 text-[#676264]">
              {t("account", { email })}
            </p>
          ) : null}

          {error ? (
            <p role="alert" className={ERROR_ALERT}>
              {error}
            </p>
          ) : null}

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
        </div>

        <button type="submit" disabled={isSubmitting} className={PRIMARY_BUTTON}>
          {isSubmitting ? t("submitting") : t("submit")}
        </button>
      </form>
    </PasswordResetLayout>
  );
};

export default ResetPassword;
