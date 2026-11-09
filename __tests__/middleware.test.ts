// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl/middleware", () => ({
  default: () => () => NextResponse.next(),
}));

import middleware from "@/middleware";

function request(
  path: string,
  cookie?: string,
  fetchMode: string | null = "navigate",
) {
  return new NextRequest(`https://sap.test${path}`, {
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(fetchMode ? { "sec-fetch-mode": fetchMode } : {}),
    },
  });
}

describe("middleware", () => {
  beforeEach(() => {
    vi.stubEnv("PLATFORM_ACCESS_GUARD_ENABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends a platform link without session to the login, keeping the link", () => {
    const response = middleware(
      request("/pt/platform?section=communication&locationKey=2504009"),
    );

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/pt/login");
    expect(location.searchParams.get("redirect")).toBe(
      "/platform?section=communication&locationKey=2504009",
    );
  });

  it("keeps the locale of the link", () => {
    const response = middleware(request("/en/platform/amfe"));

    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/en/login");
    expect(location.searchParams.get("redirect")).toBe("/platform/amfe");
  });

  it("lets a platform request with session through", () => {
    const response = middleware(request("/pt/platform", "session=abc"));

    expect(response.headers.get("location")).toBeNull();
  });

  // O prefetch feito na tela de login, antes da senha, fica guardado no
  // roteador: se ele recebesse o 307, a pessoa voltaria ao login depois de entrar.
  it.each(["cors", "same-origin", null])(
    "leaves router requests (sec-fetch-mode %s) to the platform layout",
    (fetchMode) => {
      const response = middleware(
        request("/pt/platform", undefined, fetchMode),
      );

      expect(response.headers.get("location")).toBeNull();
    },
  );

  it("does not send other pages to the login", () => {
    const response = middleware(request("/pt/glossario"));

    expect(response.headers.get("location")).toBeNull();
  });
});

describe("middleware with the platform open", () => {
  beforeEach(() => {
    vi.stubEnv("PLATFORM_ACCESS_GUARD_ENABLED", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lets a platform link without session through instead of sending it to the login", () => {
    const response = middleware(request("/pt/platform?section=communication"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("gives the browser its own visitor id, so a room behind one address does not share one quota", () => {
    const response = middleware(request("/pt/platform"));

    const visitor = response.cookies.get("sedes_visitor");
    expect(visitor?.value).toMatch(/^[0-9a-f-]{36}$/);
    expect(visitor?.httpOnly).toBe(true);
  });

  it("keeps the visitor id the browser already has", () => {
    const response = middleware(
      request(
        "/pt/platform",
        "sedes_visitor=11111111-1111-1111-1111-111111111111",
      ),
    );

    expect(response.cookies.get("sedes_visitor")).toBeUndefined();
  });

  it.each([
    "/pt/platform?view=logs",
    "/pt/platform?view=catalog",
    "/pt/platform/aprovacoes",
  ])(
    "still sends the team screen %s to the login, keeping the link",
    (path) => {
      const response = middleware(request(path));

      expect(response.status).toBe(307);
      const location = new URL(response.headers.get("location")!);
      expect(location.pathname).toBe("/pt/login");
      expect(location.searchParams.get("redirect")).toBe(path.slice(3));
    },
  );

  it("does not hand visitor ids outside the platform", () => {
    const response = middleware(request("/pt/glossario"));

    expect(response.cookies.get("sedes_visitor")).toBeUndefined();
  });
});
