import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { cookiesMock, redirectMock, notFoundMock, resolveLogsViewerAccessMock } =
  vi.hoisted(() => ({
    cookiesMock: vi.fn(),
    redirectMock: vi.fn((path: string) => {
      throw new Error(`redirect:${path}`);
    }),
    notFoundMock: vi.fn(() => {
      throw new Error("notFound");
    }),
    resolveLogsViewerAccessMock: vi.fn(),
  }));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

vi.mock("@/lib/logs-access", () => ({
  resolveLogsViewerAccess: resolveLogsViewerAccessMock,
}));

import PlatformLogsLayout from "@/app/platform/logs/layout";

describe("PlatformLogsLayout", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    redirectMock.mockClear();
    notFoundMock.mockClear();
    resolveLogsViewerAccessMock.mockReset();

    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "session-cookie" }),
    });
  });

  it("redirects to login when the viewer is not authenticated", async () => {
    resolveLogsViewerAccessMock.mockResolvedValueOnce("unauthenticated");

    await expect(
      PlatformLogsLayout({ children: <div>Logs</div> }),
    ).rejects.toThrow("redirect:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("returns not found when the authenticated email is outside the allowlist", async () => {
    resolveLogsViewerAccessMock.mockResolvedValueOnce("forbidden");

    await expect(
      PlatformLogsLayout({ children: <div>Logs</div> }),
    ).rejects.toThrow("notFound");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("renders the dashboard subtree for an allowlisted viewer", async () => {
    resolveLogsViewerAccessMock.mockResolvedValueOnce("allowed");

    const result = await PlatformLogsLayout({ children: <div>Logs</div> });
    render(result);

    expect(screen.getByText("Logs")).toBeInTheDocument();
  });
});
