import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { platformSidebarMock, platformMapMock } = vi.hoisted(() => ({
  platformSidebarMock: vi.fn(),
  platformMapMock: vi.fn(),
}));

vi.mock("@/components/MapLayerContext/MapLayerContext", () => ({
  MapLayerProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/Amfe/AmfeAnalysisContext", () => ({
  AmfeAnalysisProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

vi.mock("@/components/PlatformMap/PlatformMap", () => ({
  PlatformMap: (props: Record<string, unknown>) => {
    platformMapMock(props);
    return <div data-testid="platform-map-probe" />;
  },
}));

vi.mock("@/components/Amfe/AmfeAnalysisFormColumn", () => ({
  AmfeAnalysisFormColumn: () => <div data-testid="amfe-form-probe" />,
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
  platformSidebarMock.mockReset();
  platformMapMock.mockReset();
});

describe("PlatformLayout", () => {
  // Monitoramento, Análise e Comunicação dividem uma instância só de mapa:
  // trocar de seção muda as propriedades dele, nunca a montagem. Reconstruir o
  // MapLibre custava perto de um segundo por troca.
  it("keeps a single map mounted across the sections that use it", () => {
    const { rerender } = render(
      <PlatformLayout panelLayers={[]} initialSection="monitoring" />,
    );

    expect(screen.getByTestId("platform-map-probe")).toBeInTheDocument();
    expect(platformMapMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        section: "monitoring",
        showMonitoringControls: true,
      }),
    );

    rerender(<PlatformLayout panelLayers={[]} initialSection="analysis" />);

    expect(screen.getByTestId("platform-map-probe")).toBeInTheDocument();
  });

  it("opens the analysis section beside the map instead of replacing it", () => {
    render(<PlatformLayout panelLayers={[]} initialSection="analysis" />);

    expect(screen.getByTestId("platform-map-probe")).toBeInTheDocument();
    expect(screen.getByTestId("amfe-form-probe")).toBeInTheDocument();
    expect(platformMapMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ section: "analysis" }),
    );
    expect(platformSidebarMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        panelLayers: [],
        initialSection: "analysis",
        viewMode: "default",
      }),
    );
  });

  // Comunicação mantém o mapa montado por baixo do relatório: é o que faz
  // voltar para Monitoramento custar uma troca de propriedades, e não uma
  // reconstrução.
  it("keeps the map behind the report when communication opens first", () => {
    render(
      <PlatformLayout
        panelLayers={[]}
        showAuditLink
        initialSection="communication"
      />,
    );

    expect(screen.getByTestId("platform-map-probe")).toBeInTheDocument();
    expect(screen.queryByTestId("amfe-form-probe")).not.toBeInTheDocument();
    expect(platformMapMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        section: "communication",
        showMonitoringControls: false,
      }),
    );
    expect(platformSidebarMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        panelLayers: [],
        showAuditLink: true,
        initialSection: "communication",
        viewMode: "default",
      }),
    );
  });

  it("replaces the map with the logs dashboard when the logs view is active", () => {
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

  // Regressão: o rodapé passou a ser renderizado dentro da plataforma e, com a
  // casca ocupando só o espaço que sobrava, ele roubava 160px da tela em
  // Monitoramento. A casca precisa medir a viewport menos o cabeçalho para que o
  // rodapé caia abaixo da dobra — igual em todas as seções.
  it("sizes every platform shell from the viewport below the header", () => {
    const { unmount } = render(
      <PlatformLayout panelLayers={[]} initialSection="analysis" />,
    );

    const analysisShell = screen.getByTestId(
      "platform-sidebar-probe",
    ).parentElement;

    expect(analysisShell).toHaveClass("min-h-[calc(100vh-66px)]");
    expect(analysisShell?.className).not.toContain("min-h-0");

    unmount();

    render(<PlatformLayout viewMode="catalog" catalogDashboard={<div />} />);

    const catalogShell = screen.getByTestId(
      "platform-catalog-shell",
    ).parentElement;

    expect(catalogShell).toHaveClass("min-h-[calc(100vh-66px)]");
  });
});
