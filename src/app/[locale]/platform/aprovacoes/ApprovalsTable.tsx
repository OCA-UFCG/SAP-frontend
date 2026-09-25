"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export interface ApprovalRow {
  uid: string;
  email: string;
  intention: string;
  /**
   * Já formatada no servidor. Formatar aqui usaria o fuso e o idioma do
   * servidor na primeira renderização e os do navegador na segunda, e o React
   * reclamaria da diferença.
   */
  requestedAt: string;
}

type RowState =
  | "idle"
  | "working"
  | "approved"
  | "rejected"
  | "conflict"
  | "failed";

const BUTTON =
  "cursor-pointer rounded-md px-3 py-1.5 text-[12px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60";

export function ApprovalsTable({ rows }: { rows: ApprovalRow[] }) {
  const t = useTranslations("Approvals");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [states, setStates] = useState<Record<string, RowState>>({});

  async function decide(uid: string, decision: "approved" | "rejected") {
    setStates((current) => ({ ...current, [uid]: "working" }));

    try {
      const response = await fetch("/api/signup/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, decision }),
      });

      if (response.ok) {
        setStates((current) => ({ ...current, [uid]: decision }));
        // Recarrega a lista do servidor: sem isso, um pedido decidido por outro
        // operador continuava aparecendo aqui como se estivesse esperando.
        startTransition(() => router.refresh());
        return;
      }

      // 409 é "alguém decidiu antes de você" — bem diferente de uma falha, e a
      // pessoa precisa saber qual dos dois aconteceu.
      setStates((current) => ({
        ...current,
        [uid]: response.status === 409 ? "conflict" : "failed",
      }));

      if (response.status === 409) {
        startTransition(() => router.refresh());
      }
    } catch {
      setStates((current) => ({ ...current, [uid]: "failed" }));
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-[14px] leading-6 text-[#676264]">{t("empty")}</p>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-md border border-[#DBE0CC]">
      <table className="w-full min-w-[42rem] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-[#DBE0CC] bg-[#F3F5EE]">
            <th className="px-4 py-3 font-medium text-[#50554C]">
              {t("emailColumn")}
            </th>
            <th className="px-4 py-3 font-medium text-[#50554C]">
              {t("intentionColumn")}
            </th>
            <th className="whitespace-nowrap px-4 py-3 font-medium text-[#50554C]">
              {t("requestedColumn")}
            </th>
            <th className="whitespace-nowrap px-4 py-3 font-medium text-[#50554C]">
              {t("actionsColumn")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const state = states[row.uid] ?? "idle";
            const decided = state === "approved" || state === "rejected";

            return (
              <tr key={row.uid} className="border-b border-[#EFEFEF] last:border-b-0">
                <td className="px-4 py-3 align-top text-[#21240F]">{row.email}</td>
                {/* A intenção é texto de um estranho: o React já escapa, e
                    `whitespace-pre-wrap` preserva a quebra sem interpretar nada. */}
                <td className="whitespace-pre-wrap px-4 py-3 align-top text-[#676264]">
                  {row.intention}
                </td>
                <td className="whitespace-nowrap px-4 py-3 align-top text-[#676264]">
                  {row.requestedAt}
                </td>
                <td className="whitespace-nowrap px-4 py-3 align-top">
                  {decided ? (
                    <span className="text-[12px] font-medium text-[#50554C]">
                      {t(state)}
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={state === "working"}
                        onClick={() => void decide(row.uid, "approved")}
                        className={`${BUTTON} bg-[#989F43] text-white hover:bg-[#5B612A] focus-visible:ring-[#777E32]`}
                      >
                        {state === "working" ? t("working") : t("approve")}
                      </button>
                      <button
                        type="button"
                        disabled={state === "working"}
                        onClick={() => void decide(row.uid, "rejected")}
                        className={`${BUTTON} border border-[#DBE0CC] text-[#B3261E] hover:bg-[#FCE8E6] focus-visible:ring-[#B3261E]`}
                      >
                        {t("reject")}
                      </button>
                      {state === "failed" || state === "conflict" ? (
                        <span role="alert" className="text-[12px] text-[#B3261E]">
                          {state === "conflict" ? t("conflict") : t("failed")}
                        </span>
                      ) : null}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ApprovalsTable;
