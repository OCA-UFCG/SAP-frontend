import { beforeEach, describe, expect, it, vi } from "vitest";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));
vi.mock("@/repositories/content/siteContentRepository", () => ({
  getHomePageContent: async () => null,
}));
vi.mock("@/app/[locale]/cadastro/SignupPageClient", () => ({
  SignupPageClient: () => null,
}));
vi.mock("@/app/[locale]/cadastro/confirmacao/ConfirmationPageClient", () => ({
  ConfirmationPageClient: () => null,
}));

import SignupPage from "@/app/[locale]/cadastro/page";
import SignupConfirmationPage from "@/app/[locale]/cadastro/confirmacao/page";

const params = Promise.resolve({ locale: "pt" });

// Regressão: esconder o link no login não fechava as páginas. Com o bloqueio
// desligado, quem digitasse /cadastro criava uma conta que entrava direto.
describe("signup pages", () => {
  beforeEach(() => {
    notFoundMock.mockClear();
    vi.unstubAllEnvs();
  });

  it("answers 404 on the signup form while the access guard is off", async () => {
    vi.stubEnv("PLATFORM_ACCESS_GUARD_ENABLED", "false");

    await expect(SignupPage({ params })).rejects.toThrow("notFound");
  });

  it("answers 404 on the confirmation page while the access guard is off", () => {
    vi.stubEnv("PLATFORM_ACCESS_GUARD_ENABLED", "false");

    expect(() => SignupConfirmationPage()).toThrow("notFound");
  });

  it("renders both pages once the access guard is on", async () => {
    vi.stubEnv("PLATFORM_ACCESS_GUARD_ENABLED", "true");

    await expect(SignupPage({ params })).resolves.toBeTruthy();
    expect(SignupConfirmationPage()).toBeTruthy();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
