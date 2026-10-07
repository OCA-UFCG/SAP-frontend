import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";

const { pushMock, panelProps } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  panelProps: [] as Array<{
    detailLayerId?: string;
    onRequestSectionChange?: (next: PlatformSection) => void;
  }>,
}));

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

// O painel é uma sonda: o teste dirige o `onRequestSectionChange` no lugar do
// `ModulesContext`, que é quem consome o pedido de detalhamento na aplicação.
vi.mock("@/components/PlatformSidePanel/PlatformSidePanel", () => ({
  PlatformSidePanel: (props: {
    detailLayerId?: string;
    onRequestSectionChange?: (next: PlatformSection) => void;
  }) => {
    panelProps.push(props);
    return <div data-testid="platform-side-panel-probe" />;
  },
}));

vi.mock("@/components/MunicipalReport/MunicipalReportPreview", () => ({
  MunicipalReportPreview: () => <div data-testid="municipal-report-probe" />,
}));

import { PlatformSidebar } from "@/components/PlatformSidebar/PlatformSidebar";

afterEach(() => {
  cleanup();
  panelProps.length = 0;
  pushMock.mockReset();
});

function lastPanelProps() {
  return panelProps[panelProps.length - 1];
}

describe("PlatformSidebar > pedido de detalhamento", () => {
  it("entrega ao painel o índice pedido pela URL", () => {
    render(<PlatformSidebar panelLayers={[]} detailLayerId="anaseca" />);

    expect(lastPanelProps().detailLayerId).toBe("anaseca");
  });

  it("esquece o pedido depois de aberto, para o botão de voltar funcionar", () => {
    render(<PlatformSidebar panelLayers={[]} detailLayerId="anaseca" />);

    // O `ModulesContext` consome o pedido pedindo o detalhamento.
    act(() => lastPanelProps().onRequestSectionChange?.("analysis-detail"));
    // E o botão "voltar para a listagem" do detalhamento pede monitoring.
    act(() => lastPanelProps().onRequestSectionChange?.("monitoring"));

    // Sem esquecer o pedido, o `ModulesContext` remontaria, veria o mesmo id e
    // reabriria o detalhamento — a volta parecia não fazer nada.
    expect(lastPanelProps().detailLayerId).toBeUndefined();
  });
});
