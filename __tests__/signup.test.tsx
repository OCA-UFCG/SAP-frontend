import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Signup from "@/components/Signup/Signup";

afterEach(() => {
  cleanup();
});

describe("Signup", () => {
  it("renders the heading and the fields every signup needs", () => {
    render(<Signup />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Criar conta" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Senha")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Confirmar senha"),
    ).toBeInTheDocument();
  });

  // O campo é pedido a todo mundo, inclusive a quem entra por domínio
  // autorizado: ele é parte da trilha de auditoria, não só um insumo da decisão
  // manual. Não depende de consulta nenhuma ao servidor para aparecer.
  it("asks everyone for the intention, whatever the email domain", () => {
    render(<Signup />);

    expect(
      screen.getByPlaceholderText("Como pretende usar a plataforma?"),
    ).toBeInTheDocument();
  });

  it("submits the values once the form is valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <Signup onSubmit={onSubmit} />,
    );

    await user.type(screen.getByPlaceholderText("Email"), "fulano@ufcg.edu.br");
    await user.type(screen.getByPlaceholderText("Senha"), "uma-senha-forte");
    await user.type(
      screen.getByPlaceholderText("Confirmar senha"),
      "uma-senha-forte",
    );
    await user.type(
      screen.getByPlaceholderText("Como pretende usar a plataforma?"),
      "Pesquisa sobre seca",
    );
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: "fulano@ufcg.edu.br",
        password: "uma-senha-forte",
        intention: "Pesquisa sobre seca",
      });
    });
  });

  it("refuses to submit when the two passwords differ", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <Signup onSubmit={onSubmit} />,
    );

    await user.type(screen.getByPlaceholderText("Email"), "fulano@ufcg.edu.br");
    await user.type(screen.getByPlaceholderText("Senha"), "uma-senha-forte");
    await user.type(
      screen.getByPlaceholderText("Confirmar senha"),
      "outra-senha-forte",
    );
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByText("As senhas não são iguais.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("refuses to submit without the intention", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Signup onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText("Email"), "fulano@gmail.com");
    await user.type(screen.getByPlaceholderText("Senha"), "uma-senha-forte");
    await user.type(
      screen.getByPlaceholderText("Confirmar senha"),
      "uma-senha-forte",
    );
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(
      await screen.findByText("Descreva como pretende usar a plataforma."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // A consulta de domínio é um palpite adiantado; o servidor é a autoridade.
  // Quando ele recusa por falta de intenção, o campo aparece — inclusive nos
  // casos em que a consulta não respondeu a tempo, ou respondeu errado.
  it("reveals the intention field when the server says it is required", () => {
    render(<Signup />);

    expect(
      screen.getByPlaceholderText("Como pretende usar a plataforma?"),
    ).toBeInTheDocument();
  });

  it("keeps the field visible even if the domain check disagrees", async () => {
    const user = userEvent.setup();
    render(<Signup />);

    await user.type(screen.getByPlaceholderText("Email"), "fulano@ufcg.edu.br");
    await user.tab();

    expect(
      screen.getByPlaceholderText("Como pretende usar a plataforma?"),
    ).toBeInTheDocument();
  });

  it("shows the error the server sent back", () => {
    render(
      <Signup error="Não foi possível concluir o cadastro." />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível concluir o cadastro.",
    );
  });

  it("replaces the form with the confirmation notice once it succeeded", () => {
    render(<Signup submitted />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Confirme seu email" }),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Email")).not.toBeInTheDocument();
  });

  // O link expira e o envio pode falhar. Sem esta porta, a única saída de quem
  // não recebeu o email é abrir chamado com a equipe.
  it("always offers a way to send the email again", async () => {
    const user = userEvent.setup();
    const onResend = vi.fn();
    render(
      <Signup onResend={onResend} submitted />,
    );

    await user.click(
      screen.getByRole("button", { name: "Reenviar email de confirmação" }),
    );

    expect(onResend).toHaveBeenCalled();
  });
});
