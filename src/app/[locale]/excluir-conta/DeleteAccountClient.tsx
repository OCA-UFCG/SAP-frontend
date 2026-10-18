"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/translations/routing";
import { useAuth } from "@/contexts/AuthContext";
import {
  ERROR_ALERT,
  SECONDARY_BUTTON,
} from "@/components/PasswordReset/PasswordResetLayout";

type Status = "idle" | "working" | "done" | "ask-team";

const DANGER_BUTTON =
  "font-open-sans flex h-[33px] w-full cursor-pointer items-center justify-center rounded-md bg-[#B3261E] px-3 py-1.5 text-[11.65px] leading-5 text-white transition hover:bg-[#8C1D18] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B3261E] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70";

const INPUT_CLASS =
  "font-inter w-full rounded-[7px] bg-[#E4E5E2] px-2.5 py-2 text-[13px] font-medium leading-5 tracking-[-0.2px] text-[#292829] outline-none transition placeholder:text-[#676264] focus:ring-2 focus:ring-[#989F43]";

const ERROR_KEYS: Record<string, string> = {
  wrong_password: "wrongPassword",
  too_many_attempts: "tooManyAttempts",
};

export function DeleteAccountClient({
  email,
  canDelete,
}: {
  email: string;
  canDelete: boolean;
}) {
  const t = useTranslations("DeleteAccount");
  const { signOut } = useAuth();
  const [status, setStatus] = useState<Status>(canDelete ? "idle" : "ask-team");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

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
        setStatus("ask-team");
        return;
      }

      setError(t(ERROR_KEYS[code ?? ""] ?? "failed"));
      setStatus("idle");
    } catch {
      setError(t("failed"));
      setStatus("idle");
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-4.125rem)] w-full items-center justify-center bg-white px-6 py-16">
      <div className="flex w-full max-w-[520px] flex-col gap-6">
        <h1 className="font-inter text-[24px] font-medium leading-8 tracking-[-0.36px] text-[#50554C]">
          {status === "done" ? t("doneTitle") : t("title")}
        </h1>

        {status === "done" ? (
          <>
            <p className="text-[15px] leading-6 text-[#676264]">
              {t("doneBody")}
            </p>
            <Link href="/" className={`${SECONDARY_BUTTON} w-fit px-4`}>
              {t("backHome")}
            </Link>
          </>
        ) : status === "ask-team" ? (
          <>
            <p className="text-[15px] leading-6 text-[#676264]">
              {t("askTeam")}
            </p>
            <Link href="/contact" className={`${SECONDARY_BUTTON} w-fit px-4`}>
              {t("contactTeam")}
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <p className="text-[13px] leading-5 text-[#838B77]">
              {t("signedInAs")}{" "}
              <span className="font-medium text-[#50554C]">{email}</span>
            </p>

            <div className="flex flex-col gap-2 text-[15px] leading-6 text-[#676264]">
              <p>{t("whatIsDeleted")}</p>
              <ul className="list-disc pl-5">
                <li>{t("deletedLogin")}</li>
                <li>{t("deletedSignup")}</li>
              </ul>
              <p>{t("usageNote")}</p>
              <p className="font-medium text-[#50554C]">{t("irreversible")}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-[13px] font-medium leading-5 text-[#50554C]"
              >
                {t("passwordLabel")}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
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
              <Link href="/platform" className={SECONDARY_BUTTON}>
                {t("cancel")}
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

export default DeleteAccountClient;
