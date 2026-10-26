import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MyAccountClient } from "@/app/[locale]/minha-conta/MyAccountClient";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));

describe("MyAccountClient", () => {
  afterEach(() => {
    cleanup();
  });

  // Excluir a conta não pode estar a um clique por engano: o formulário só
  // abre depois de pedir.
  it("shows the account first and opens the delete form only on request", () => {
    render(<MyAccountClient email="pessoa@exemplo.gov.br" canDelete />);

    expect(screen.getByText("pessoa@exemplo.gov.br")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Digite sua senha para confirmar"),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Excluir minha conta" }),
    );

    expect(
      screen.getByLabelText("Digite sua senha para confirmar"),
    ).toHaveFocus();
  });

  it("closes the delete form on cancel", () => {
    render(<MyAccountClient email="pessoa@exemplo.gov.br" canDelete />);
    fireEvent.click(
      screen.getByRole("button", { name: "Excluir minha conta" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(
      screen.queryByLabelText("Digite sua senha para confirmar"),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Excluir minha conta" }),
    ).toBeInTheDocument();
  });

  it("sends shared legacy accounts to the team instead of offering deletion", () => {
    render(<MyAccountClient email="equipe@exemplo.gov.br" canDelete={false} />);

    expect(screen.getByText("equipe@exemplo.gov.br")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Excluir minha conta" }),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "Falar com a equipe" }),
    ).toBeInTheDocument();
  });
});
