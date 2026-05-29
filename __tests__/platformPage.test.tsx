import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TelemetryDashboardData } from "@/types/telemetry";

const {
  cookiesMock,
  redirectMock,
  notFoundMock,
  resolveLogsViewerAccessMock,
  getPanelLayersMock,
  getTelemetryDashboardDataMock,
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
  getTelemetryDashboardDataMock: vi.fn(),
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

vi.mock("@/services/telemetry/telemetryService", () => ({
  getTelemetryDashboardData: getTelemetryDashboardDataMock,
}));

vi.mock("@/components/PlatformLayout/PlatformLayout", () => ({
  PlatformLayout: (props: Record<string, unknown>) => {
    platformLayoutMock(props);
    return <div data-testid="platform-layout-probe" />;
  },
}));

import PlatformPage from "@/app/platform/page";

const dashboardData: TelemetryDashboardData = {
  sampledEventCount: 4,
  sampledWindowLabel: "Janela recente",
  lastReceivedAt: "2026-05-29T12:00:00.000Z",
  eventCounts: [],
  surfaceCounts: [],
  topSearchQueries: [],
  topNotFoundQueries: [],
  topActivatedLayers: [],
  topDetailedLayers: [],
  recentEvents: [],
};

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
    getTelemetryDashboardDataMock.mockReset();
    platformLayoutMock.mockReset();

    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "session-cookie" }),
    });
    getPanelLayersMock.mockResolvedValue([]);
    getTelemetryDashboardDataMock.mockResolvedValue(dashboardData);
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
    expect(getTelemetryDashboardDataMock).not.toHaveBeenCalled();
  });

  it("renders the logs mode inside /platform for allowlisted viewers", async () => {
    resolveLogsViewerAccessMock.mockResolvedValueOnce("allowed");

    const result = await PlatformPage({
      searchParams: Promise.resolve({ view: "logs" }),
    });
    render(result);

    expect(screen.getByTestId("platform-layout-probe")).toBeInTheDocument();
    expect(getPanelLayersMock).not.toHaveBeenCalled();
    expect(getTelemetryDashboardDataMock).toHaveBeenCalledTimes(1);
    expect(platformLayoutMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        showAuditLink: true,
        viewMode: "logs",
        telemetryDashboardData: dashboardData,
      }),
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
    expect(getTelemetryDashboardDataMock).not.toHaveBeenCalled();
  });
});
