import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, redirectMock, resolvePlatformAccessMock } = vi.hoisted(
  () => ({
    cookiesMock: vi.fn(),
    redirectMock: vi.fn(),
    resolvePlatformAccessMock: vi.fn(),
  }),
);

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("@/translations/routing", () => ({ redirect: redirectMock }));
vi.mock("@/lib/platform-access", () => ({
  resolvePlatformAccess: resolvePlatformAccessMock,
}));

import PlatformLayout from "@/app/[locale]/platform/layout";

function mockSessionCookie(value?: string) {
  cookiesMock.mockResolvedValue({
    get: () => (value ? { value } : undefined),
  });
}

describe("platform layout guard", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    redirectMock.mockReset();
    resolvePlatformAccessMock.mockReset();
  });

  it("sends an unauthenticated visitor to the login page", async () => {
    mockSessionCookie();
    resolvePlatformAccessMock.mockResolvedValue("unauthenticated");

    await PlatformLayout({
      children: "conteudo",
      params: Promise.resolve({ locale: "en" }),
    });

    expect(redirectMock).toHaveBeenCalledWith({
      href: "/login",
      locale: "en",
    });
  });

  // Quem está logado mas ainda não foi liberado não pode cair no /login: já tem
  // sessão válida, então logar de novo devolveria a pessoa para o mesmo lugar.
  it("sends a signed-in but unapproved visitor to the waiting page", async () => {
    mockSessionCookie("session-cookie");
    resolvePlatformAccessMock.mockResolvedValue("unapproved");

    await PlatformLayout({
      children: "conteudo",
      params: Promise.resolve({ locale: "en" }),
    });

    // O idioma vai junto: sem isso, quem navega em /en cai numa página em
    // português no momento em que mais precisa entender o que houve.
    expect(redirectMock).toHaveBeenCalledWith({
      href: "/aguardando-liberacao",
      locale: "en",
    });
  });

  it("renders the platform for an approved visitor", async () => {
    mockSessionCookie("session-cookie");
    resolvePlatformAccessMock.mockResolvedValue("approved");

    const result = await PlatformLayout({
      children: "conteudo",
      params: Promise.resolve({ locale: "en" }),
    });

    expect(redirectMock).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });

  it("resolves the access from the session cookie it read", async () => {
    mockSessionCookie("session-cookie");
    resolvePlatformAccessMock.mockResolvedValue("approved");

    await PlatformLayout({
      children: "conteudo",
      params: Promise.resolve({ locale: "en" }),
    });

    expect(resolvePlatformAccessMock).toHaveBeenCalledWith("session-cookie");
  });
});
