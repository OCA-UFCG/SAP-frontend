// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/middleware", () => ({
  default: () => () => NextResponse.next(),
}));

import middleware from "@/middleware";

function request(path: string, cookie?: string) {
  return new NextRequest(`https://sap.test${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

describe("middleware", () => {
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

  it("does not send other pages to the login", () => {
    const response = middleware(request("/pt/glossario"));

    expect(response.headers.get("location")).toBeNull();
  });
});
