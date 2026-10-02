import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPassword from "@/components/PasswordReset/ForgotPassword";
import { ForgotPasswordPageClient } from "@/app/[locale]/esqueci-senha/ForgotPasswordPageClient";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ForgotPassword", () => {
  it("asks for the account email", () => {
    render(<ForgotPassword />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Esqueci minha senha" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para o login" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("blocks a malformed address before anything is sent", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ForgotPassword onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText("Email"), "fulano");
    await user.click(screen.getByRole("button", { name: "Enviar link" }));

    expect(await screen.findByText("Informe um email válido.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the typed address", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ForgotPassword onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText("Email"), "fulano@ufcg.edu.br");
    await user.click(screen.getByRole("button", { name: "Enviar link" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith("fulano@ufcg.edu.br");
    });
  });

  // A frase não pode afirmar que a conta existe: seria o oráculo de quem é
  // usuário da plataforma.
  it("tells the person to check the inbox without saying the account exists", () => {
    render(<ForgotPassword submittedEmail="fulano@ufcg.edu.br" />);

    expect(
      screen.getByText(/Se houver uma conta com fulano@ufcg\.edu\.br/),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Email")).not.toBeInTheDocument();
  });

  it("lets the person ask for the link again", async () => {
    const user = userEvent.setup();
    const onResend = vi.fn();
    render(
      <ForgotPassword submittedEmail="fulano@ufcg.edu.br" onResend={onResend} />,
    );

    await user.click(screen.getByRole("button", { name: "Enviar o link de novo" }));

    expect(onResend).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Se houver uma conta com esse endereço, um novo link foi enviado.",
    );
  });
});

describe("ForgotPasswordPageClient", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  async function requestFor(email: string) {
    const user = userEvent.setup();
    render(<ForgotPasswordPageClient />);

    await user.type(screen.getByPlaceholderText("Email"), email);
    await user.click(screen.getByRole("button", { name: "Enviar link" }));
  }

  it("asks the server for the link in the language of the page", async () => {
    fetchMock.mockResolvedValue(Response.json({ status: "accepted" }, { status: 202 }));

    await requestFor("fulano@ufcg.edu.br");

    expect(await screen.findByText(/Se houver uma conta/)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/password-reset");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "fulano@ufcg.edu.br",
      locale: "pt",
    });
  });

  it("shows the server's refusal, such as the rate limit", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { error: "Muitas tentativas. Tente novamente em instantes." },
        { status: 429 },
      ),
    );

    await requestFor("fulano@ufcg.edu.br");

    expect(await screen.findByRole("alert")).toHaveTextContent("Muitas tentativas.");
  });

  it("explains a network failure instead of staying silent", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await requestFor("fulano@ufcg.edu.br");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível enviar o link agora.",
    );
  });
});
