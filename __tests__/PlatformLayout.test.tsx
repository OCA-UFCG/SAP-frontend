import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { platformSidebarMock } = vi.hoisted(() => ({
  platformSidebarMock: vi.fn(),
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

import { PlatformLayout } from "@/components/PlatformLayout/PlatformLayout";

afterEach(() => {
  cleanup();
});

describe("PlatformLayout", () => {
  it("renders the map shell when the platform is in its default view", () => {
    platformSidebarMock.mockReset();

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

    render(
      <PlatformLayout
        showAuditLink
        viewMode="logs"
        telemetryDashboard={<div data-testid="telemetry-dashboard-probe" />}
      />,
    );

    expect(screen.queryByTestId("platform-map-probe")).not.toBeInTheDocument();
    expect(screen.getByTestId("telemetry-dashboard-probe")).toBeInTheDocument();
    expect(screen.getByTestId("platform-logs-shell")).not.toHaveClass(
      "pl-[140px]",
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
