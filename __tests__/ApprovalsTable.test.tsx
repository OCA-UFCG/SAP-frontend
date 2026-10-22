import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApprovalsTable } from "@/app/[locale]/platform/aprovacoes/ApprovalsTable";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("ApprovalsTable", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("anuncia a decisão e mantém o foco na tabela", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    render(
      <ApprovalsTable
        rows={[
          {
            uid: "1",
            email: "ana@exemplo.org",
            intention: "Pesquisa",
            requestedAt: "21/10/2026",
          },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Aprovar" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "ana@exemplo.org: Aprovado",
    );
    expect(screen.getByRole("table").parentElement).toHaveFocus();
  });
});
