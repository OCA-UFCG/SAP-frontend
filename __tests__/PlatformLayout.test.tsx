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

vi.mock("@/components/Amfe/AmfeScreen", () => ({
  AmfeScreen: () => <div data-testid="amfe-screen-probe" />,
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
  it("renders the sidebar without the map shell when communication opens first", () => {
    platformSidebarMock.mockReset();

    render(
      <PlatformLayout
        panelLayers={[]}
        showAuditLink
        initialSection="communication"
      />,
    );

    expect(screen.queryByTestId("platform-map-probe")).not.toBeInTheDocument();
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

  it("renders the protected catalog as a utility view without the map", () => {
    platformSidebarMock.mockReset();

    render(
      <PlatformLayout
        showAuditLink
        viewMode="catalog"
        catalogDashboard={<div data-testid="catalog-dashboard-probe" />}
      />,
    );

    expect(screen.queryByTestId("platform-map-probe")).not.toBeInTheDocument();
    expect(screen.getByTestId("catalog-dashboard-probe")).toBeInTheDocument();
    expect(screen.getByTestId("platform-catalog-shell")).toHaveClass(
      "pl-[140px]",
    );
    expect(platformSidebarMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        panelLayers: [],
        showAuditLink: true,
        viewMode: "catalog",
      }),
    );
  });
  it("replaces the map with the multicriteria screen on a definite-height shell", () => {
    platformSidebarMock.mockReset();

    render(<PlatformLayout viewMode="amfe" initialSection="analysis" />);

    expect(screen.queryByTestId("platform-map-probe")).not.toBeInTheDocument();
    expect(screen.getByTestId("amfe-screen-probe")).toBeInTheDocument();
    // A casca preenche o espaço que sobra do `main`, em vez de reivindicar a
    // viewport inteira: com o rodapé abaixo dela, reivindicar 100vh empurrava o
    // documento para além da tela e deixava rolar os componentes para fora.
    expect(screen.getByTestId("platform-amfe-shell")).toHaveClass(
      "flex-1",
      "min-h-0",
    );
    expect(screen.getByTestId("platform-amfe-shell").className).not.toContain(
      "100vh",
    );
    expect(platformSidebarMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        panelLayers: [],
        viewMode: "amfe",
        initialSection: "analysis",
      }),
    );
  });

  // Regressão: o rodapé fica abaixo da plataforma. Enquanto a casca exigia uma
  // viewport inteira, o documento ficava mais alto que a tela e a roda do mouse
  // sobre qualquer área neutra arrastava os componentes para fora do campo de
  // visão. A casca precisa caber no que sobra do `main`, não reivindicar 100vh.
  it("sizes the platform shell from the space left by the header and footer", () => {
    platformSidebarMock.mockReset();

    render(<PlatformLayout viewMode="amfe" initialSection="analysis" />);

    const wrapper = screen.getByTestId("platform-amfe-shell").parentElement;

    expect(wrapper).toHaveClass("flex-1", "min-h-0");
    expect(wrapper?.className).not.toContain("100vh");
  });
});
