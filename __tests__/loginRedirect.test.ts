import { describe, expect, it } from "vitest";
import { getPlatformRedirectPath } from "@/app/[locale]/login/LoginPageClient";

describe("getPlatformRedirectPath", () => {
  it("keeps platform redirects", () => {
    expect(getPlatformRedirectPath("/platform")).toBe("/platform");
    expect(getPlatformRedirectPath("/platform/reports")).toBe(
      "/platform/reports",
    );
  });

  it("keeps the query of a platform link", () => {
    expect(
      getPlatformRedirectPath("/platform?section=communication&locationKey=2504009"),
    ).toBe("/platform?section=communication&locationKey=2504009");
  });

  it("falls back to the platform for empty or external redirects", () => {
    expect(getPlatformRedirectPath(null)).toBe("/platform");
    expect(getPlatformRedirectPath("/")).toBe("/platform");
    expect(getPlatformRedirectPath("https://example.test")).toBe("/platform");
    expect(getPlatformRedirectPath("//example.test")).toBe("/platform");
  });
});
