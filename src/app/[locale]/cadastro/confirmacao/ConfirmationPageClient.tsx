"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/translations/routing";
import { LOGIN_PATH } from "@/config/accessRoutes";

type Outcome = "checking" | "approved" | "pending" | "rejected" | "failed";

const PRIMARY_BUTTON =
  "font-open-sans flex h-[33px] w-fit items-center justify-center rounded-md bg-[#989F43] px-4 py-1.5 text-[11.65px] leading-5 text-white transition hover:bg-[#5B612A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#777E32] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70";

export function ConfirmationPageClient() {
  const t = useTranslations("SignupConfirmation");
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [outcome, setOutcome] = useState<Outcome>("checking");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    let active = true;

    async function confirm() {
      try {
        const response = await fetch("/api/signup/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        if (!active) return;

        if (!response.ok) {
          setOutcome("failed");
          return;
        }

        const { status } = (await response.json()) as { status?: Outcome };
        setOutcome(
          status === "approved" || status === "pending" || status === "rejected"
            ? status
            : "failed",
        );
      } catch {
        if (active) setOutcome("failed");
      }
    }

    void confirm();

    return () => {
      active = false;
    };
  }, [email]);

  const handleResend = useCallback(async () => {
    setResending(true);

    try {
      await fetch("/api/signup/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // A resposta é sempre genérica de qualquer forma; falhar em silêncio aqui
      // mostra a mesma mensagem que o sucesso, que é o comportamento desejado.
    } finally {
      setResending(false);
      setResent(true);
    }
  }, [email]);

  const copy = {
    checking: { title: t("checking"), body: "" },
    approved: { title: t("approvedTitle"), body: t("approvedBody") },
    pending: { title: t("pendingTitle"), body: t("pendingBody") },
    rejected: { title: t("rejectedTitle"), body: t("rejectedBody") },
    failed: { title: t("failedTitle"), body: t("failedBody") },
  }[outcome];

  return (
    <main className="flex min-h-[calc(100vh-4.125rem)] w-full items-center justify-center bg-white px-6 py-16">
      <div className="flex w-full max-w-[520px] flex-col gap-6">
        <h1 className="font-inter text-[24px] font-medium leading-8 tracking-[-0.36px] text-[#50554C]">
          {copy.title}
        </h1>

        {copy.body ? (
          <p className="text-[15px] leading-6 text-[#676264]">{copy.body}</p>
        ) : null}

        {outcome === "approved" ? (
          <Link href={LOGIN_PATH} className={PRIMARY_BUTTON}>
            {t("enter")}
          </Link>
        ) : null}

        {outcome === "failed" ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || !email}
              className={`${PRIMARY_BUTTON} cursor-pointer`}
            >
              {resending ? t("resending") : t("resend")}
            </button>
            {resent ? (
              <p role="status" className="text-[13px] leading-5 text-[#50554C]">
                {t("resent")}
              </p>
            ) : null}
          </div>
        ) : null}

        {outcome !== "checking" && outcome !== "approved" ? (
          <Link
            href="/"
            className="text-[13px] leading-5 text-[#777E32] underline underline-offset-2 hover:text-[#5B612A]"
          >
            {t("backHome")}
          </Link>
        ) : null}
      </div>
    </main>
  );
}

export default ConfirmationPageClient;
