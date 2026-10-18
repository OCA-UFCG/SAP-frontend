import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { searchParams } = vi.hoisted(() => ({
  searchParams: { current: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams.current,
}));

vi.mock("@/app/[locale]/platform/loading", () => ({
  default: () => <div role="progressbar" />,
}));

import ResetPassword from "@/components/PasswordReset/ResetPassword";
import { ResetPasswordPageClient } from "@/app/[locale]/redefinir-senha/ResetPasswordPageClient";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function fillPasswords(password: string, confirmation = password) {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("Nova senha"), password);
  await user.type(screen.getByPlaceholderText("Confirmar nova senha"), confirmation);
  await user.click(screen.getByRole("button", { name: "Trocar senha" }));
}

describe("ResetPassword", () => {
  it("shows whose password is being changed", () => {
    render(<ResetPassword status="ready" email="fulano@ufcg.edu.br" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Escolha uma nova senha" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Conta: fulano@ufcg.edu.br")).toBeInTheDocument();
  });

  it("holds the new password to the same minimum as the signup", async () => {
    const onSubmit = vi.fn();
    render(<ResetPassword status="ready" onSubmit={onSubmit} />);

    await fillPasswords("curta");

    expect(
      await screen.findByText("A senha precisa de pelo menos 8 caracteres."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("requires the confirmation to match", async () => {
    const onSubmit = vi.fn();
    render(<ResetPassword status="ready" onSubmit={onSubmit} />);

    await fillPasswords("senha-nova-1", "senha-nova-2");

    expect(await screen.findByText("As senhas não são iguais.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the new password once both fields agree", async () => {
    const onSubmit = vi.fn();
    render(<ResetPassword status="ready" onSubmit={onSubmit} />);

    await fillPasswords("senha-nova-1");

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith("senha-nova-1");
    });
  });

  it("shows both fields in clear text with the eye toggle", async () => {
    const user = userEvent.setup();
    render(<ResetPassword status="ready" />);

    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));

    expect(screen.getByPlaceholderText("Nova senha")).toHaveAttribute("type", "text");
    expect(screen.getByPlaceholderText("Confirmar nova senha")).toHaveAttribute(
      "type",
      "text",
    );
  });

  it("offers a new link when this one no longer works", () => {
    render(<ResetPassword status="invalid" />);

    expect(screen.getByRole("link", { name: "Pedir um novo link" })).toHaveAttribute(
      "href",
      "/esqueci-senha",
    );
    expect(screen.queryByPlaceholderText("Nova senha")).not.toBeInTheDocument();
  });

  it("sends the person to sign in once the password changed", () => {
    render(<ResetPassword status="done" />);

    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});

describe("ResetPasswordPageClient", () => {
  const fetchMock = vi.fn();

  function answer(path: string, body: unknown, status = 200) {
    fetchMock.mockImplementation(async (url: string) =>
      url === path ? Response.json(body, { status }) : Response.json({}, { status: 404 }),
    );
  }

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    searchParams.current = new URLSearchParams({ code: "ABC123" });
  });

  it("checks the code on arrival and shows the form for that account", async () => {
    answer("/api/password-reset/check", { email: "fulano@ufcg.edu.br" });

    render(<ResetPasswordPageClient />);

    expect(await screen.findByText("Conta: fulano@ufcg.edu.br")).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ code: "ABC123" });
  });

  it("says the link expired without asking the server when there is no code", async () => {
    searchParams.current = new URLSearchParams();

    render(<ResetPasswordPageClient />);

    expect(
      await screen.findByRole("heading", { name: "Este link não vale mais" }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says the link expired when the server says the code is unusable", async () => {
    answer("/api/password-reset/check", { reason: "invalid-code" }, 410);

    render(<ResetPasswordPageClient />);

    expect(
      await screen.findByRole("heading", { name: "Este link não vale mais" }),
    ).toBeInTheDocument();
  });

  // Barrado pelo limite não quer dizer link vencido: mandar pedir outro seria
  // mandar a pessoa embora à toa.
  it("keeps the form when the check is only rate limited", async () => {
    answer("/api/password-reset/check", { error: "Muitas tentativas." }, 429);

    render(<ResetPasswordPageClient />);

    expect(await screen.findByPlaceholderText("Nova senha")).toBeInTheDocument();
  });

  it("changes the password and confirms it", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === "/api/password-reset/check"
        ? Response.json({ email: "fulano@ufcg.edu.br" })
        : Response.json({ status: "changed" }),
    );

    render(<ResetPasswordPageClient />);
    await screen.findByText("Conta: fulano@ufcg.edu.br");
    await fillPasswords("senha-nova-1");

    expect(
      await screen.findByRole("heading", { name: "Senha trocada" }),
    ).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/password-reset/confirm");
    expect(JSON.parse(init.body as string)).toEqual({
      code: "ABC123",
      password: "senha-nova-1",
    });
  });

  it("explains a password the security rules refused", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === "/api/password-reset/check"
        ? Response.json({ email: "fulano@ufcg.edu.br" })
        : Response.json({ reason: "weak-password" }, { status: 400 }),
    );

    render(<ResetPasswordPageClient />);
    await screen.findByText("Conta: fulano@ufcg.edu.br");
    await fillPasswords("senhasemnumero");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Essa senha não atende às regras de segurança.",
    );
  });

  it("moves to the expired state when the code was used meanwhile", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === "/api/password-reset/check"
        ? Response.json({ email: "fulano@ufcg.edu.br" })
        : Response.json({ reason: "invalid-code" }, { status: 410 }),
    );

    render(<ResetPasswordPageClient />);
    await screen.findByText("Conta: fulano@ufcg.edu.br");
    await fillPasswords("senha-nova-1");

    expect(
      await screen.findByRole("heading", { name: "Este link não vale mais" }),
    ).toBeInTheDocument();
  });
});
