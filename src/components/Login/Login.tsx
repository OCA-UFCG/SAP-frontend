"use client";

import { useForm } from "react-hook-form";

export type LoginFormValues = {
  login: string;
  password: string;
};

type LoginProps = {
  onSubmit?: (values: LoginFormValues) => void | Promise<void>;
};

export const Login = ({ onSubmit }: LoginProps) => {
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

  return (
    <section className="flex w-full justify-center bg-[#F6F7F6] px-6 py-12 text-[#292829] sm:px-10 lg:px-[80px]">
      <div className="flex w-full max-w-[424px] flex-col gap-8 rounded-lg border border-[#EFEFEF] bg-white p-6 shadow-sm sm:p-8">
        <header className="flex flex-col gap-2">
          <h1 className="font-inter text-[24px] font-semibold leading-8 text-[#292829]">
            Acesso ao SAP
          </h1>
          <p className="text-[14px] leading-5 text-[#7E797B]">
            Entre com suas credenciais para acessar a plataforma.
          </p>
        </header>

        <form className="flex flex-col gap-5" onSubmit={submitLogin} noValidate>
          <div className="flex flex-col gap-2">
            <label
              className="text-[14px] font-medium leading-5 text-[#292829]"
              htmlFor="login"
            >
              Login
            </label>
            <input
              id="login"
              type="text"
              autoComplete="username"
              aria-invalid={Boolean(errors.login)}
              className="h-10 w-full rounded-lg border border-transparent bg-[#E4E5E2] px-3 py-3 text-sm text-[#292829] shadow-sm outline-none transition placeholder:text-[#898989] hover:border-neutral-400 focus:border-[#777E32] focus:ring-2 focus:ring-[#777E32]/20"
              placeholder="Digite seu login"
              {...register("login", {
                required: "Informe o login.",
              })}
            />
            {errors.login ? (
              <p className="text-[12px] leading-5 text-red-600">
                {errors.login.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <label
              className="text-[14px] font-medium leading-5 text-[#292829]"
              htmlFor="password"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              className="h-10 w-full rounded-lg border border-transparent bg-[#E4E5E2] px-3 py-3 text-sm text-[#292829] shadow-sm outline-none transition placeholder:text-[#898989] hover:border-neutral-400 focus:border-[#777E32] focus:ring-2 focus:ring-[#777E32]/20"
              placeholder="Digite sua senha"
              {...register("password", {
                required: "Informe a senha.",
              })}
            />
            {errors.password ? (
              <p className="text-[12px] leading-5 text-red-600">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-3 flex h-10 w-full cursor-pointer items-center justify-center rounded-lg bg-[#989F43] px-4 py-2 text-[14px] font-medium leading-6 text-white shadow-sm transition hover:bg-[#5B612A] focus:outline-none focus:ring-2 focus:ring-[#777E32] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </section>
  );
};

export default Login;
