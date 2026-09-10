import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Login from "@/components/Login/Login";

afterEach(() => {
  cleanup();
});

describe("Login", () => {
  it("renders the SEDES logo, the heading and the two fields from the design", () => {
    render(<Login />);

    expect(screen.getByRole("img", { name: /sedes/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Entrar" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Senha")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue" }),
    ).toBeInTheDocument();
  });

  it("hides the password until the eye toggle is pressed", async () => {
    const user = userEvent.setup();
    render(<Login />);

    const password = screen.getByPlaceholderText("Senha");
    expect(password).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));

    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar senha" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("hides the password again when the eye toggle is pressed twice", async () => {
    const user = userEvent.setup();
    render(<Login />);

    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));

    expect(screen.getByPlaceholderText("Senha")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("shows the authentication error coming from the auth context", () => {
    render(<Login error="Credenciais inválidas." />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Credenciais inválidas.",
    );
  });

  it("blocks submission and reports both required fields when the form is empty", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Login onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Informe o login.")).toBeInTheDocument();
    expect(screen.getByText("Informe a senha.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the typed credentials", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Login onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText("Email"), "ana@sedes.gov.br");
    await user.type(screen.getByPlaceholderText("Senha"), "segredo123");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        login: "ana@sedes.gov.br",
        password: "segredo123",
      });
    });
  });
});
