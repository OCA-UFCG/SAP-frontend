import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookiesMock,
  resolveLogsViewerAccessMock,
  getPanelLayersMock,
  platformSidebarMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  resolveLogsViewerAccessMock: vi.fn(),
  getPanelLayersMock: vi.fn(),
  platformSidebarMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/logs-access", () => ({
  resolveLogsViewerAccess: resolveLogsViewerAccessMock,
}));

vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayers: getPanelLayersMock,
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

describe("PlatformLayout", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    resolveLogsViewerAccessMock.mockReset();
    getPanelLayersMock.mockReset();
    platformSidebarMock.mockReset();

    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "session-cookie" }),
    });
    getPanelLayersMock.mockResolvedValue([]);
  });

  it("passes the audit rail flag when the authenticated viewer can access logs", async () => {
    resolveLogsViewerAccessMock.mockResolvedValueOnce("allowed");

    const result = await PlatformLayout();
    render(result);

    expect(screen.getByTestId("platform-map-probe")).toBeInTheDocument();
    expect(screen.getByTestId("platform-sidebar-probe")).toBeInTheDocument();
    expect(platformSidebarMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        panelLayers: [],
        showAuditLink: true,
      }),
    );
  });

  it("keeps the audit rail flag disabled when the viewer is outside the logs allowlist", async () => {
    resolveLogsViewerAccessMock.mockResolvedValueOnce("forbidden");

    const result = await PlatformLayout();
    render(result);

    expect(platformSidebarMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        panelLayers: [],
        showAuditLink: false,
      }),
    );
  });
});
