"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/translations/routing";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  ERROR_ALERT,
  SECONDARY_BUTTON,
} from "@/components/PasswordReset/PasswordResetLayout";

type Status = "closed" | "idle" | "working" | "done";

export const DANGER_OUTLINE_BUTTON =
  "font-open-sans flex h-[33px] w-fit cursor-pointer items-center justify-center rounded-md border border-[#B3261E] px-4 py-1.5 text-[0.728125rem] leading-5 text-[#B3261E] transition hover:bg-[#FCE8E6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B3261E] focus-visible:ring-offset-2";

export const DANGER_BUTTON =
  "font-open-sans flex h-[33px] w-full cursor-pointer items-center justify-center rounded-md bg-[#B3261E] px-3 py-1.5 text-[0.728125rem] leading-5 text-white transition hover:bg-[#8C1D18] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B3261E] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70";

export const INPUT_CLASS =
  "font-inter w-full rounded-[7px] bg-[#E4E5E2] px-2.5 py-2 text-[0.8125rem] font-medium leading-5 tracking-[-0.2px] text-[#292829] outline-none transition placeholder:text-[#676264] focus:ring-2 focus:ring-[#989F43]";

const ERROR_KEYS: Record<string, string> = {
  wrong_password: "wrongPassword",
  too_many_attempts: "tooManyAttempts",
};

/**
 * A conta de quem está logado. Excluir fica no fim e só abre o formulário
 * depois de um clique, para não ser a primeira coisa da página.
 */
export function MyAccountClient({
  email,
  canDelete,
}: {
  email: string;
  canDelete: boolean;
}) {
  const t = useTranslations("MyAccount");
  const { signOut } = useAuth();
  const [status, setStatus] = useState<Status>("closed");
  const [askTeam, setAskTeam] = useState(!canDelete);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);

  // O botão "Excluir minha conta" some quando o formulário abre; o foco vai
  // para a senha em vez de cair no começo da página.
  useEffect(() => {
    if (status === "idle") passwordRef.current?.focus();
  }, [status]);

  function closeForm() {
    setStatus("closed");
    setPassword("");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("working");

    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        setStatus("done");
        // A conta já não existe; isto só limpa o login guardado no navegador.
        await signOut().catch(() => undefined);
        return;
      }

      const { code } = (await response.json().catch(() => ({}))) as {
        code?: string;
      };

      if (code === "ask_team") {
        setAskTeam(true);
        closeForm();
        return;
      }

      setError(t(ERROR_KEYS[code ?? ""] ?? "failed"));
      setStatus("idle");
    } catch {
      setError(t("failed"));
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <main className="flex min-h-[calc(100vh-4.125rem)] w-full items-center justify-center bg-white px-6 py-16">
        <div className="flex w-full max-w-[520px] flex-col gap-6">
          <h1 className="font-inter text-[1.5rem] font-medium leading-8 tracking-[-0.36px] text-[#50554C]">
            {t("doneTitle")}
          </h1>
          <p className="text-[0.9375rem] leading-6 text-[#676264]">
            {t("doneBody")}
          </p>
          <Link href="/" className={cn(SECONDARY_BUTTON, "w-fit px-4")}>
            {t("backHome")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-4.125rem)] w-full justify-center bg-white px-6 py-16">
      <div className="flex w-full max-w-[520px] flex-col gap-8">
        <div className="flex flex-col gap-6">
          <h1 className="font-inter text-[1.5rem] font-medium leading-8 tracking-[-0.36px] text-[#50554C]">
            {t("title")}
          </h1>
          <dl className="flex flex-col gap-1">
            <dt className="text-[0.8125rem] leading-5 text-[#838B77]">
              {t("emailLabel")}
            </dt>
            <dd className="text-[0.9375rem] font-medium leading-6 text-[#50554C]">
              {email}
            </dd>
          </dl>
        </div>

        <section
          aria-labelledby="delete-account-title"
          className="flex flex-col gap-4 border-t border-stone-200 pt-6"
        >
          <h2
            id="delete-account-title"
            className="font-inter text-[1.125rem] font-medium leading-7 tracking-[-0.36px] text-[#50554C]"
          >
            {t("deleteTitle")}
          </h2>

          {askTeam ? (
            <>
              <p className="text-[0.9375rem] leading-6 text-[#676264]">
                {t("askTeam")}
              </p>
              <Link
                href="/contact"
                className={cn(SECONDARY_BUTTON, "w-fit px-4")}
              >
                {t("contactTeam")}
              </Link>
            </>
          ) : status === "closed" ? (
            <>
              <p className="text-[0.9375rem] leading-6 text-[#676264]">
                {t("deleteSummary")}
              </p>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className={DANGER_OUTLINE_BUTTON}
              >
                {t("openDelete")}
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2 text-[0.9375rem] leading-6 text-[#676264]">
                <p>{t("whatIsDeleted")}</p>
                <ul className="list-disc pl-5">
                  <li>{t("deletedLogin")}</li>
                  <li>{t("deletedSignup")}</li>
                </ul>
                <p>{t("usageNote")}</p>
                <p className="font-medium text-[#50554C]">
                  {t("irreversible")}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="password"
                  className="text-[0.8125rem] font-medium leading-5 text-[#50554C]"
                >
                  {t("passwordLabel")}
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  ref={passwordRef}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              {error ? (
                <p role="alert" className={ERROR_ALERT}>
                  {error}
                </p>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={status === "working" || !password}
                  className={DANGER_BUTTON}
                >
                  {status === "working" ? t("working") : t("submit")}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={status === "working"}
                  className={SECONDARY_BUTTON}
                >
                  {t("cancel")}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

export default MyAccountClient;
