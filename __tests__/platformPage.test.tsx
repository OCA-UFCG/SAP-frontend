import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookiesMock,
  redirectMock,
  notFoundMock,
  resolveLogsViewerAccessMock,
  getPanelLayersMock,
  platformLayoutMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("notFound");
  }),
  resolveLogsViewerAccessMock: vi.fn(),
  getPanelLayersMock: vi.fn(),
  platformLayoutMock: vi.fn(),
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

vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayers: getPanelLayersMock,
}));

vi.mock("@/components/PlatformLayout/PlatformLayout", () => ({
  PlatformLayout: (props: Record<string, unknown>) => {
    platformLayoutMock(props);
    return <div data-testid="platform-layout-probe" />;
  },
}));

import PlatformPage from "@/app/[locale]/platform/page";

afterEach(() => {
  cleanup();
});

describe("PlatformPage", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    redirectMock.mockClear();
    notFoundMock.mockClear();
    resolveLogsViewerAccessMock.mockReset();
    getPanelLayersMock.mockReset();
    platformLayoutMock.mockReset();

    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "session-cookie" }),
    });
    getPanelLayersMock.mockResolvedValue([]);
  });

  it("renders the default platform shell and forwards the audit entry state", async () => {
    resolveLogsViewerAccessMock.mockResolvedValueOnce("allowed");

    const result = await PlatformPage({
      searchParams: Promise.resolve({ section: "communication" }),
    });
    render(result);

    expect(screen.getByTestId("platform-layout-probe")).toBeInTheDocument();
    expect(platformLayoutMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        panelLayers: [],
        showAuditLink: true,
        initialSection: "communication",
      }),
    );
    expect(getPanelLayersMock).toHaveBeenCalledTimes(1);
  });

  it("renders the logs mode shell inside /platform for allowlisted viewers", async () => {
    resolveLogsViewerAccessMock.mockResolvedValueOnce("allowed");

    const result = await PlatformPage({
      searchParams: Promise.resolve({ view: "logs" }),
    });
    render(result);

    expect(screen.getByTestId("platform-layout-probe")).toBeInTheDocument();
    expect(getPanelLayersMock).not.toHaveBeenCalled();
    expect(platformLayoutMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        showAuditLink: true,
        viewMode: "logs",
        telemetryDashboard: expect.any(Object),
      }),
    );
    expect(platformLayoutMock.mock.calls[0]?.[0]).not.toHaveProperty(
      "telemetryDashboardData",
    );
  });

  it("redirects logs requests to login when no session cookie is available", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    });

    await expect(
      PlatformPage({
        searchParams: Promise.resolve({ view: "logs" }),
      }),
    ).rejects.toThrow("redirect:/login");
    expect(resolveLogsViewerAccessMock).not.toHaveBeenCalled();
  });

  it("returns not found for authenticated viewers outside the logs allowlist", async () => {
    resolveLogsViewerAccessMock.mockResolvedValueOnce("forbidden");

    await expect(
      PlatformPage({
        searchParams: Promise.resolve({ view: "logs" }),
      }),
    ).rejects.toThrow("notFound");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});
