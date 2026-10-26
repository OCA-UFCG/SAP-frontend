"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/translations/routing";
import { cn } from "@/lib/utils";
import {
  ERROR_ALERT,
  SECONDARY_BUTTON,
} from "@/components/PasswordReset/PasswordResetLayout";
import {
  DANGER_BUTTON,
  DANGER_OUTLINE_BUTTON,
  INPUT_CLASS,
} from "@/app/[locale]/minha-conta/MyAccountClient";

type Status = "closed" | "idle" | "working" | "done";

const ERROR_KEYS: Record<string, string> = {
  wrong_credentials: "wrongCredentials",
  too_many_attempts: "tooManyAttempts",
  ask_team: "askTeam",
};

/**
 * Desistir do pedido e apagar os dados, para quem ainda está na fila. Sem
 * acesso não há sessão, então a pessoa informa e-mail e senha de novo. Como em
 * "Minha conta", o formulário só abre depois de um clique.
 */
export function WithdrawRequestClient() {
  const t = useTranslations("PendingApproval");
  const [status, setStatus] = useState<Status>("closed");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorKey, setErrorKey] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "idle") emailRef.current?.focus();
  }, [status]);

  function closeForm() {
    setStatus("closed");
    setPassword("");
    setErrorKey("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorKey("");
    setStatus("working");

    try {
      const response = await fetch("/api/account/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        setStatus("done");
        return;
      }

      const { code } = (await response.json().catch(() => ({}))) as {
        code?: string;
      };

      setErrorKey(ERROR_KEYS[code ?? ""] ?? "failed");
      setStatus("idle");
    } catch {
      setErrorKey("failed");
      setStatus("idle");
    }
  }

  return (
    <section
      aria-labelledby="withdraw-request-title"
      className="flex flex-col gap-4 border-t border-stone-200 pt-6"
    >
      <h2
        id="withdraw-request-title"
        className="font-inter text-[1.125rem] font-medium leading-7 tracking-[-0.36px] text-[#50554C]"
      >
        {status === "done" ? t("doneTitle") : t("withdrawTitle")}
      </h2>

      {status === "done" ? (
        <p role="status" className="text-[0.9375rem] leading-6 text-[#676264]">
          {t("doneBody")}
        </p>
      ) : status === "closed" ? (
        <>
          <p className="text-[0.9375rem] leading-6 text-[#676264]">
            {t("withdrawSummary")}
          </p>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className={DANGER_OUTLINE_BUTTON}
          >
            {t("openWithdraw")}
          </button>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <p className="text-[0.9375rem] leading-6 text-[#676264]">
            {t("withdrawExplain")}
          </p>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="withdraw-email"
              className="text-[0.8125rem] font-medium leading-5 text-[#50554C]"
            >
              {t("emailLabel")}
            </label>
            <input
              id="withdraw-email"
              type="email"
              autoComplete="username"
              required
              ref={emailRef}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="withdraw-password"
              className="text-[0.8125rem] font-medium leading-5 text-[#50554C]"
            >
              {t("passwordLabel")}
            </label>
            <input
              id="withdraw-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          {errorKey ? (
            <p role="alert" className={ERROR_ALERT}>
              {t(errorKey)}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={status === "working" || !email || !password}
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

      {errorKey === "askTeam" && status !== "done" ? (
        <Link href="/contact" className={cn(SECONDARY_BUTTON, "w-fit px-4")}>
          {t("contactTeam")}
        </Link>
      ) : null}
    </section>
  );
}

export default WithdrawRequestClient;
