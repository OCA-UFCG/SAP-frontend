import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Verificação do Firebase controlada pelo teste: resolve só quando mandarmos. */
class FakeFirebaseSessionVerifier {
  calls: string[] = [];
  private settle: ((isValid: boolean) => void) | null = null;

  verify = (sessionCookie: string) => {
    this.calls.push(sessionCookie);
    return new Promise<boolean>((resolve) => {
      this.settle = resolve;
    });
  };

  answer(isValid: boolean) {
    this.settle?.(isValid);
  }
}

const { redirectMock, cookieJar, verifier } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  cookieJar: new Map<string, string>(),
  verifier: { current: null as FakeFirebaseSessionVerifier | null },
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined,
  }),
}));
vi.mock("@/lib/server-session", () => ({
  SESSION_COOKIE_NAME: "session",
  verifyFirebaseSessionCookie: (cookie: string) =>
    verifier.current!.verify(cookie),
}));

import PlatformLayout from "@/app/[locale]/platform/layout";
import PlatformLoading from "@/app/[locale]/platform/loading";

interface SessionGateProps {
  sessionCookie: string;
  children: ReactNode;
}

function readSessionGate(layoutOutput: ReactElement) {
  const gate = (layoutOutput.props as { children: ReactElement }).children;
  const renderGate = gate.type as (
    props: SessionGateProps,
  ) => Promise<ReactElement>;
  return () => renderGate(gate.props as SessionGateProps);
}

describe("platform session layout", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    cookieJar.clear();
    verifier.current = new FakeFirebaseSessionVerifier();
  });

  it("redirects to /login without waiting for Firebase when there is no cookie", async () => {
    await expect(
      PlatformLayout({ children: <div>Plataforma</div> }),
    ).rejects.toThrow("redirect:/login");
    expect(verifier.current!.calls).toEqual([]);
  });

  it("returns the loading screen as fallback before the session check finishes", async () => {
    cookieJar.set("session", "cookie-valido");

    const layoutOutput = await PlatformLayout({
      children: <div>Plataforma</div>,
    });

    const fallback = (layoutOutput.props as { fallback: ReactNode }).fallback;
    expect(isValidElement(fallback) && fallback.type).toBe(PlatformLoading);
    expect(verifier.current!.calls).toEqual([]);
  });

  it("delivers the page only after Firebase accepts the session", async () => {
    cookieJar.set("session", "cookie-valido");
    const layoutOutput = await PlatformLayout({
      children: <div>Plataforma</div>,
    });

    const gateRender = readSessionGate(layoutOutput)();
    verifier.current!.answer(true);
    const gateOutput = await gateRender;

    expect(verifier.current!.calls).toEqual(["cookie-valido"]);
    expect((gateOutput.props as { children: ReactElement }).children).toEqual(
      <div>Plataforma</div>,
    );
  });

  it("redirects to /login when Firebase rejects the session", async () => {
    cookieJar.set("session", "cookie-revogado");
    const layoutOutput = await PlatformLayout({
      children: <div>Plataforma</div>,
    });

    const gateRender = readSessionGate(layoutOutput)();
    verifier.current!.answer(false);

    await expect(gateRender).rejects.toThrow("redirect:/login");
  });
});
