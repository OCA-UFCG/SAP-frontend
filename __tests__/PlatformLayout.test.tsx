import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TelemetryDashboardData } from "@/types/telemetry";

const { platformSidebarMock, telemetryDashboardMock } = vi.hoisted(() => ({
  platformSidebarMock: vi.fn(),
  telemetryDashboardMock: vi.fn(),
}));

vi.mock("@/components/MapLayerContext/MapLayerContext", () => ({
  MapLayerProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/PlatformMap/PlatformMap", () => ({
  PlatformMap: () => <div data-testid="platform-map-probe" />,
}));

vi.mock("@/components/PlatformSidebar/PlatformSidebar", () => ({
  PlatformSidebar: (props: Record<string, unknown>) => {
    platformSidebarMock(props);
    return <div data-testid="platform-sidebar-probe" />;
  },
}));

vi.mock("@/components/TelemetryDashboard/TelemetryDashboard", () => ({
  TelemetryDashboard: (props: Record<string, unknown>) => {
    telemetryDashboardMock(props);
    return <div data-testid="telemetry-dashboard-probe" />;
  },
}));

import { PlatformLayout } from "@/components/PlatformLayout/PlatformLayout";

const dashboardData: TelemetryDashboardData = {
  sampledEventCount: 3,
  sampledWindowLabel: "Janela recente",
  lastReceivedAt: "2026-05-29T10:00:00.000Z",
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

describe("PlatformLayout", () => {
  it("renders the map shell when the platform is in its default view", () => {
    platformSidebarMock.mockReset();
    telemetryDashboardMock.mockReset();

    render(
      <PlatformLayout
        panelLayers={[]}
        showAuditLink
        initialSection="communication"
      />,
    );

    expect(screen.getByTestId("platform-map-probe")).toBeInTheDocument();
    expect(screen.getByTestId("platform-sidebar-probe")).toBeInTheDocument();
    expect(platformSidebarMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        panelLayers: [],
        showAuditLink: true,
        initialSection: "communication",
        viewMode: "default",
      }),
    );
    expect(
      screen.queryByTestId("telemetry-dashboard-probe"),
    ).not.toBeInTheDocument();
  });

  it("replaces the map with the logs dashboard when the logs view is active", () => {
    platformSidebarMock.mockReset();
    telemetryDashboardMock.mockReset();

    render(
      <PlatformLayout
        showAuditLink
        viewMode="logs"
        telemetryDashboardData={dashboardData}
      />,
    );

    expect(screen.queryByTestId("platform-map-probe")).not.toBeInTheDocument();
    expect(screen.getByTestId("telemetry-dashboard-probe")).toBeInTheDocument();
    expect(screen.getByTestId("platform-logs-shell")).not.toHaveClass(
      "pl-[140px]",
    );
    expect(telemetryDashboardMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        data: dashboardData,
      }),
    );
    expect(platformSidebarMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        panelLayers: [],
        showAuditLink: true,
        viewMode: "logs",
      }),
    );
  });
});
