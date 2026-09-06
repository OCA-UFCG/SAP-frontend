import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("@/translations/routing", () => ({
  useRouter: () => ({ push: pushMock }),
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/MapLayerContext/MapLayerContext", () => ({
  useMapLayerActions: () => ({ setActiveLegend: vi.fn() }),
}));

vi.mock("@/components/PlatformSidePanel/PlatformSidePanel", () => ({
  PlatformSidePanel: () => <div data-testid="platform-side-panel-probe" />,
}));

vi.mock("@/components/MunicipalReport/MunicipalReportPreview", () => ({
  MunicipalReportPreview: () => <div data-testid="municipal-report-probe" />,
}));

import { PlatformSidebar } from "@/components/PlatformSidebar/PlatformSidebar";

afterEach(() => {
  cleanup();
  pushMock.mockReset();
});

describe("PlatformSidebar section switching", () => {
  // O motivo desta mudança: Análise era outra rota, e trocar de seção
  // desmontava o mapa e construía outro. Dentro da plataforma a troca agora é
  // estado de cliente, sem navegação nenhuma.
  it("opens analysis without navigating away from the platform", async () => {
    const user = userEvent.setup();
    const onActiveSectionChange = vi.fn();

    render(
      <PlatformSidebar
        panelLayers={[]}
        onActiveSectionChange={onActiveSectionChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Análise/i }));

    expect(pushMock).not.toHaveBeenCalled();
    expect(onActiveSectionChange).toHaveBeenCalledWith("analysis");
  });

  it("returns from analysis to monitoring without navigating either", async () => {
    const user = userEvent.setup();
    const onActiveSectionChange = vi.fn();

    render(
      <PlatformSidebar
        panelLayers={[]}
        initialSection="analysis"
        onActiveSectionChange={onActiveSectionChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Monitoramento/i }));

    expect(pushMock).not.toHaveBeenCalled();
    expect(onActiveSectionChange).toHaveBeenCalledWith("monitoring");
  });

  // Entrar por `?section=communication` também não prende ninguém: o mapa fica
  // montado por baixo do relatório, então voltar é uma troca de seção.
  it("leaves the communication entry point without navigating", async () => {
    const user = userEvent.setup();

    render(<PlatformSidebar panelLayers={[]} initialSection="communication" />);

    await user.click(screen.getByRole("button", { name: /Monitoramento/i }));

    expect(pushMock).not.toHaveBeenCalled();
  });

  // Auditoria e catálogo são outras páginas: de lá, voltar exige navegar.
  it("navigates back to the platform from a utility view", async () => {
    const user = userEvent.setup();

    render(<PlatformSidebar panelLayers={[]} viewMode="logs" />);

    await user.click(screen.getByRole("button", { name: /Análise/i }));
    expect(pushMock).toHaveBeenCalledWith("/platform/amfe");

    await user.click(screen.getByRole("button", { name: /Monitoramento/i }));
    expect(pushMock).toHaveBeenCalledWith("/platform");
  });
});
