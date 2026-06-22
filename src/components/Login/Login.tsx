"use client";

import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";

export type LoginFormValues = {
  login: string;
  password: string;
};

type LoginProps = {
  onSubmit?: (values: LoginFormValues) => void | Promise<void>;
  backgroundImageUrl?: string;
  error?: string;
};

export const Login = ({ onSubmit, backgroundImageUrl, error }: LoginProps) => {
  const t = useTranslations("Login");
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

  const backgroundImage = backgroundImageUrl
    ? `linear-gradient(120deg, rgba(39, 41, 22, 0.86), rgba(39, 41, 22, 0.28)), url("${backgroundImageUrl}")`
    : "linear-gradient(120deg, #4A4E26, #989F43)";

  return (
    <section
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#4A4E26] bg-cover bg-center px-4 py-12"
      style={{ backgroundImage }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.22),transparent_34%),linear-gradient(180deg,rgba(0,0,0,0.18),rgba(0,0,0,0.42))]" />

      <div className="relative z-10 flex w-full max-w-[462px] flex-col gap-8 rounded-lg border border-white/45 bg-white/24 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-8">
        <header className="flex flex-col gap-2">
          <h1 className="font-inter text-[24px] font-semibold leading-8 text-white drop-shadow-sm">
            {t("title")}
          </h1>
          <p className="text-[14px] leading-5 text-white/82">
            {t("description")}
          </p>
        </header>

        {error ? (
          <div className="rounded-lg border border-red-200/70 bg-red-50/90 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}

        <form className="flex flex-col gap-5" onSubmit={submitLogin} noValidate>
          <div className="flex flex-col gap-2">
            <input
              id="login"
              type="text"
              autoComplete="username"
              aria-label="Login"
              aria-invalid={Boolean(errors.login)}
              className="h-10 w-full rounded-lg border border-white/30 bg-white/82 px-3 py-3 text-sm text-[#292829] shadow-sm outline-none transition placeholder:text-[#6D6D6D] hover:border-white/70 focus:border-white focus:ring-2 focus:ring-white/35"
              placeholder={t("emailPlaceholder")}
              {...register("login", {
                required: t("emailRequired"),
              })}
            />
            {errors.login ? (
              <p className="text-[12px] leading-5 text-red-100">
                {errors.login.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-label="Senha"
              aria-invalid={Boolean(errors.password)}
              className="h-10 w-full rounded-lg border border-white/30 bg-white/82 px-3 py-3 text-sm text-[#292829] shadow-sm outline-none transition placeholder:text-[#6D6D6D] hover:border-white/70 focus:border-white focus:ring-2 focus:ring-white/35"
              placeholder={t("passwordPlaceholder")}
              {...register("password", {
                required: t("passwordRequired"),
              })}
            />
            {errors.password ? (
              <p className="text-[12px] leading-5 text-red-100">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-3 flex h-10 w-full cursor-pointer items-center justify-center rounded-lg bg-[#989F43] px-4 py-2 text-[14px] font-medium leading-6 text-white shadow-sm transition hover:bg-[#5B612A] focus:outline-none focus:ring-2 focus:ring-[#777E32] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? t("submitting") : t("submit")}
          </button>
        </form>
      </div>
    </section>
  );
};

export default Login;
