import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LocaleErrorBoundary from "@/app/[locale]/error";
import LocaleNotFound from "@/app/[locale]/not-found";
import PlatformLoading from "@/app/[locale]/platform/loading";

describe("LocaleErrorBoundary", () => {
  beforeEach(() => {
    cleanup();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mostra a mensagem traduzida em vez da tela padrão do Next", () => {
    render(
      <LocaleErrorBoundary
        error={new Error("contentful down")}
        reset={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Algo deu errado por aqui" }),
    ).toBeInTheDocument();
    // A descrição é opcional no ErrorScreen desde que o 404 deixou de ter uma.
    // Aqui ela continua sendo obrigatória: é o que diz que a falha é passageira.
    expect(screen.getByText(/não respondeu a tempo/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tentar de novo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar para o início" }),
    ).toHaveAttribute("href", "/");
  });

  it("chama reset ao clicar em tentar de novo", async () => {
    const reset = vi.fn();
    render(<LocaleErrorBoundary error={new Error("falhou")} reset={reset} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Tentar de novo" }),
    );

    expect(reset).toHaveBeenCalledOnce();
  });

  // O digest é o que liga a tela do visitante à linha do log no servidor.
  it("mostra o digest quando o Next envia um", () => {
    const error = Object.assign(new Error("falhou"), { digest: "abc123" });
    render(<LocaleErrorBoundary error={error} reset={vi.fn()} />);

    expect(screen.getByText("Código do erro: abc123")).toBeInTheDocument();
  });

  it("omite a linha do digest quando não há um", () => {
    render(<LocaleErrorBoundary error={new Error("falhou")} reset={vi.fn()} />);

    expect(screen.queryByText(/Código do erro/)).not.toBeInTheDocument();
  });

  it("registra a falha no console para o log do servidor", () => {
    const error = Object.assign(new Error("falhou"), { digest: "abc123" });
    render(<LocaleErrorBoundary error={error} reset={vi.fn()} />);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("abc123"),
      error,
    );
  });
});

describe("LocaleNotFound", () => {
  beforeEach(cleanup);

  // O caso real é o gate da LOGS_ALLOWED_EMAILS: a tela não pode dizer nada
  // que confirme, para quem não tem acesso, que a página existe.
  it("mostra só o título, sem revelar por que a página não veio", () => {
    const { container } = render(<LocaleNotFound />);

    expect(
      screen.getByRole("heading", { name: "Página não encontrada" }),
    ).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/acesso|permiss|conta|existe/i);
  });

  it("oferece saída para o início e para a plataforma", () => {
    render(<LocaleNotFound />);

    expect(
      screen.getByRole("link", { name: "Voltar para o início" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("link", { name: "Ir para a plataforma" }),
    ).toHaveAttribute("href", "/platform");
  });
});

describe("PlatformLoading", () => {
  beforeEach(cleanup);

  it("anuncia a espera para leitores de tela", () => {
    render(<PlatformLoading />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Carregando a plataforma");
    expect(status).toHaveAttribute("aria-live", "polite");
  });
});
