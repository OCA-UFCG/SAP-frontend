"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export interface AccountRow {
  uid: string;
  email: string;
  revoked: boolean;
  /** "Cadastro" ou "Conta antiga", já traduzido no servidor. */
  origin: string;
  /** Já formatada no servidor, pelo mesmo motivo de `ApprovalRow.requestedAt`. */
  since: string;
  intention: string;
  /** A conta de quem está vendo a tela: sem ações, para ninguém se trancar fora. */
  self: boolean;
}

type Action = "revoke" | "restore" | "delete";
type RowState = "idle" | "working" | "confirm-delete" | "deleted" | "failed";

const BUTTON =
  "cursor-pointer rounded-md px-3 py-1.5 text-[12px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60";
const NEUTRAL = `${BUTTON} border border-[#DBE0CC] text-[#50554C] hover:bg-[#F3F5EE] focus-visible:ring-[#777E32]`;
const DANGER = `${BUTTON} border border-[#DBE0CC] text-[#B3261E] hover:bg-[#FCE8E6] focus-visible:ring-[#B3261E]`;
const DANGER_SOLID = `${BUTTON} bg-[#B3261E] text-white hover:bg-[#8C1D18] focus-visible:ring-[#B3261E]`;

export function AccountsTable({ rows }: { rows: AccountRow[] }) {
  const t = useTranslations("Approvals");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [states, setStates] = useState<Record<string, RowState>>({});

  function setRow(uid: string, state: RowState) {
    setStates((current) => ({ ...current, [uid]: state }));
  }

  async function run(uid: string, action: Action) {
    setRow(uid, "working");

    try {
      const response = await fetch("/api/signup/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, action }),
      });

      if (!response.ok) {
        setRow(uid, "failed");
        return;
      }

      setRow(uid, action === "delete" ? "deleted" : "idle");
      startTransition(() => router.refresh());
    } catch {
      setRow(uid, "failed");
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-[14px] leading-6 text-[#676264]">
        {t("accountsEmpty")}
      </p>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-md border border-[#DBE0CC]">
      <table className="w-full min-w-[48rem] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-[#DBE0CC] bg-[#F3F5EE]">
            <th className="px-4 py-3 font-medium text-[#50554C]">
              {t("emailColumn")}
            </th>
            <th className="px-4 py-3 font-medium text-[#50554C]">
              {t("intentionColumn")}
            </th>
            <th className="whitespace-nowrap px-4 py-3 font-medium text-[#50554C]">
              {t("originColumn")}
            </th>
            <th className="whitespace-nowrap px-4 py-3 font-medium text-[#50554C]">
              {t("statusColumn")}
            </th>
            <th className="whitespace-nowrap px-4 py-3 font-medium text-[#50554C]">
              {t("actionsColumn")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const state = states[row.uid] ?? "idle";
            const working = state === "working";

            return (
              <tr
                key={row.uid}
                className="border-b border-[#EFEFEF] last:border-b-0"
              >
                <td className="px-4 py-3 align-top text-[#21240F]">
                  {row.email}
                </td>
                <td className="whitespace-pre-wrap px-4 py-3 align-top text-[#676264]">
                  {row.intention || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 align-top text-[#676264]">
                  {row.origin}
                </td>
                <td className="whitespace-nowrap px-4 py-3 align-top">
                  <span
                    className={
                      row.revoked
                        ? "text-[#B3261E]"
                        : "text-[#5B612A]"
                    }
                  >
                    {row.revoked ? t("statusRevoked") : t("statusActive")}
                  </span>
                  <span className="block text-[12px] text-[#838B77]">
                    {t("since", { date: row.since })}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 align-top">
                  {row.self ? (
                    <span className="text-[12px] text-[#838B77]">
                      {t("yourAccount")}
                    </span>
                  ) : state === "deleted" ? (
                    <span className="text-[12px] font-medium text-[#50554C]">
                      {t("deleted")}
                    </span>
                  ) : state === "confirm-delete" ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void run(row.uid, "delete")}
                        className={DANGER_SOLID}
                      >
                        {t("confirmDelete")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRow(row.uid, "idle")}
                        className={NEUTRAL}
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={working}
                        onClick={() =>
                          void run(row.uid, row.revoked ? "restore" : "revoke")
                        }
                        className={NEUTRAL}
                      >
                        {working
                          ? t("working")
                          : row.revoked
                            ? t("restore")
                            : t("revoke")}
                      </button>
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => setRow(row.uid, "confirm-delete")}
                        className={DANGER}
                      >
                        {t("delete")}
                      </button>
                      {state === "failed" ? (
                        <span
                          role="alert"
                          className="text-[12px] text-[#B3261E]"
                        >
                          {t("failed")}
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

export default AccountsTable;
