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
    // A AMFE precisa de uma altura definida: é ela que dá limite ao
    // `overflow-y-auto` do formulário. Sem isso a página inteira passa a rolar e
    // o mapa é empurrado para fora da tela.
    expect(screen.getByTestId("platform-amfe-shell")).toHaveClass(
      "h-[calc(100vh-66px)]",
    );
    expect(platformSidebarMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        panelLayers: [],
        viewMode: "amfe",
        initialSection: "analysis",
      }),
    );
  });

  // Regressão: o rodapé passou a ser renderizado dentro da plataforma e, com a
  // casca ocupando só o espaço que sobrava, ele roubava 160px da tela em
  // Monitoramento. A casca precisa medir a viewport menos o cabeçalho para que o
  // rodapé caia abaixo da dobra — igual em todas as seções.
  it("sizes every platform shell from the viewport below the header", () => {
    const shells = [
      { props: { viewMode: "amfe" as const }, testId: "platform-amfe-shell" },
      {
        props: { viewMode: "catalog" as const, catalogDashboard: <div /> },
        testId: "platform-catalog-shell",
      },
    ];

    for (const { props, testId } of shells) {
      platformSidebarMock.mockReset();

      const { unmount } = render(
        <PlatformLayout {...props} initialSection="analysis" />,
      );

      const wrapper = screen.getByTestId(testId).parentElement;

      expect(wrapper).toHaveClass("min-h-[calc(100vh-66px)]");
      expect(wrapper?.className).not.toContain("min-h-0");

      unmount();
    }
  });
});
