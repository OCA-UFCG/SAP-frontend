import React, { useEffect } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), refresh: vi.fn(), push: vi.fn() },
  signIn: vi.fn(),
  watch: vi.fn(),
  announceSignupEntered: vi.fn(),
  announceSignupConfirmed: vi.fn(),
  onSignupEntered: vi.fn(),
}));

vi.mock("@/translations/routing", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement("a", { href, ...props }, children),
  useRouter: () => mocks.router,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ signIn: mocks.signIn }),
}));

vi.mock("@/lib/signup-auto-entry", () => ({
  watchSignupConfirmation: mocks.watch,
  announceSignupEntered: mocks.announceSignupEntered,
  announceSignupConfirmed: mocks.announceSignupConfirmed,
  onSignupEntered: mocks.onSignupEntered,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("code=codigo-do-email"),
}));

vi.mock("@/components/Captcha/Captcha", () => ({
  Captcha: ({ onToken }: { onToken: (token: string | null) => void }) => {
    useEffect(() => onToken("captcha-token"), [onToken]);
    return null;
  },
}));

import { SignupPageClient } from "@/app/[locale]/cadastro/SignupPageClient";
import { ConfirmationPageClient } from "@/app/[locale]/cadastro/confirmacao/ConfirmationPageClient";

async function fillAndSubmitSignup() {
  const user = userEvent.setup();
  render(<SignupPageClient />);

  await user.type(
    screen.getByPlaceholderText("Email (de preferência institucional)"),
    "fulano@gmail.com",
  );
  await user.type(screen.getByPlaceholderText("Senha"), "uma-senha-forte");
  await user.type(
    screen.getByPlaceholderText("Confirmar senha"),
    "uma-senha-forte",
  );
  await user.type(
    screen.getByPlaceholderText(
      "Como pretende usar a plataforma? Se tiver vínculo com alguma instituição, informe qual.",
    ),
    "Pesquisa sobre seca",
  );
  await user.click(screen.getByRole("button", { name: "Criar conta" }));

  await waitFor(() => expect(mocks.watch).toHaveBeenCalledTimes(1));

  return mocks.watch.mock.calls[0][0] as {
    email: string;
    password: string;
    onConfirmed: () => Promise<void>;
  };
}

describe("entrada automática depois do cadastro", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ status: "accepted" }), { status: 201 }),
      ),
    );
    mocks.watch.mockReset().mockReturnValue(() => undefined);
    mocks.signIn.mockReset();
    mocks.router.replace.mockReset();
    mocks.router.refresh.mockReset();
    mocks.announceSignupEntered.mockReset();
    mocks.announceSignupConfirmed.mockReset();
    mocks.onSignupEntered.mockReset().mockReturnValue(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("starts waiting for the confirmation with what was just typed", async () => {
    const watch = await fillAndSubmitSignup();

    expect(watch.email).toBe("fulano@gmail.com");
    expect(watch.password).toBe("uma-senha-forte");
  });

  it("enters the platform once the e-mail is confirmed, and tells the other tab", async () => {
    mocks.signIn.mockResolvedValue("ok");
    const watch = await fillAndSubmitSignup();

    await watch.onConfirmed();

    expect(mocks.signIn).toHaveBeenCalledWith(
      "fulano@gmail.com",
      "uma-senha-forte",
    );
    expect(mocks.announceSignupEntered).toHaveBeenCalledTimes(1);
    expect(mocks.router.replace).toHaveBeenCalledWith("/platform");
  });

  // Sem a liberação automática ligada, quem não é de domínio autorizado
  // confirma e espera a equipe: a aba vai para a página de espera.
  it("goes to the waiting page when the signup still needs the team", async () => {
    mocks.signIn.mockResolvedValue("pending");
    const watch = await fillAndSubmitSignup();

    await watch.onConfirmed();

    expect(mocks.router.replace).toHaveBeenCalledWith("/aguardando-liberacao");
    expect(mocks.announceSignupEntered).not.toHaveBeenCalled();
  });

  it("does not wait when the signup was refused", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ code: "captchaFailed" }), { status: 400 }),
    );
    const user = userEvent.setup();
    render(<SignupPageClient />);

    await user.type(
      screen.getByPlaceholderText("Email (de preferência institucional)"),
      "fulano@gmail.com",
    );
    await user.type(screen.getByPlaceholderText("Senha"), "uma-senha-forte");
    await user.type(
      screen.getByPlaceholderText("Confirmar senha"),
      "uma-senha-forte",
    );
    await user.type(
      screen.getByPlaceholderText(
        "Como pretende usar a plataforma? Se tiver vínculo com alguma instituição, informe qual.",
      ),
      "Pesquisa sobre seca",
    );
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(mocks.watch).not.toHaveBeenCalled();
  });

  it("confirmation page: points the button to the platform and announces the confirmation", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ status: "approved" }), { status: 200 }),
    );
    render(<ConfirmationPageClient />);

    const button = await screen.findByRole("link", {
      name: "Entrar na plataforma",
    });

    expect(button).toHaveAttribute("href", "/platform");
    expect(mocks.announceSignupConfirmed).toHaveBeenCalledTimes(1);
  });

  it("confirmation page: follows the signup tab into the platform", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ status: "approved" }), { status: 200 }),
    );
    render(<ConfirmationPageClient />);

    await waitFor(() => expect(mocks.onSignupEntered).toHaveBeenCalled());
    const followSignupTab = mocks.onSignupEntered.mock.calls[0][0] as () => void;
    followSignupTab();

    expect(mocks.router.replace).toHaveBeenCalledWith("/platform");
  });

  it("confirmation page: announces nothing while the signup waits for the team", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ status: "pending" }), { status: 200 }),
    );
    render(<ConfirmationPageClient />);

    await screen.findByText(/enviada à equipe do OCA/);

    expect(mocks.announceSignupConfirmed).not.toHaveBeenCalled();
    expect(mocks.onSignupEntered).not.toHaveBeenCalled();
  });
});
