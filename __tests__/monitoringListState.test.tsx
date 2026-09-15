import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type React from "react";

vi.mock("@/services/telemetry/client", () => ({
  trackUiEvent: vi.fn(),
}));

const useMapLayerActiveStateMock = vi.fn();
const useMapLayerActionsMock = vi.fn();
const useMapLayerViewStateMock = vi.fn();

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img alt={alt} {...props} />
  ),
}));

vi.mock("@/components/MapLayerContext/MapLayerContext", () => ({
  useMapLayerActiveState: () => useMapLayerActiveStateMock(),
  useMapLayerActions: () => useMapLayerActionsMock(),
  useMapLayerViewState: () => useMapLayerViewStateMock(),
}));

vi.mock("@/utils/imageData", () => ({
  getImageDataLegend: vi.fn(() => null),
}));

vi.mock("@/components/DroughtDataset/DroughtDataset", () => ({
  DroughtDataset: ({ card }: { card: { title: string } }) => (
    <article>
      <h3>{card.title}</h3>
    </article>
  ),
}));

import { ModulesContext } from "@/components/SidePanelContexts/ModulesContext";
import { MonitoringListStateProvider } from "@/components/SidePanelContexts/monitoringListState";
import type { PanelLayerI } from "@/utils/interfaces";

const panelLayers: PanelLayerI[] = [
  {
    sys: { id: "sys-ambiental" },
    id: "layer-ambiental",
    name: "Camada Ambiental",
    description: "Descricao ambiental",
    category: "Dados Ambientais",
    panelPosition: 1,
    previewMap: { url: "https://example.com/ambiental.png" },
    imageData: {},
  },
] as unknown as PanelLayerI[];

/**
 * Reproduz a ida e volta do painel: a listagem desmonta enquanto o
 * detalhamento está aberto e monta de novo ao voltar.
 */
function ListingRoundTrip({ mounted }: { mounted: boolean }) {
  return (
    <MonitoringListStateProvider>
      {mounted ? (
        <ModulesContext activeSection="monitoring" panelLayers={panelLayers} />
      ) : (
        <div>Detalhamento</div>
      )}
    </MonitoringListStateProvider>
  );
}

describe("estado da listagem de Monitoramento", () => {
  beforeEach(() => {
    useMapLayerActiveStateMock.mockReturnValue({
      activeData: null,
      activeEEData: null,
    });
    useMapLayerActionsMock.mockReturnValue({
      activateVectorLayer: vi.fn(),
      activateEeLayer: vi.fn(),
      clearActiveLayer: vi.fn(),
      setSpatialSelection: vi.fn(),
      setSelectedState: vi.fn(),
      setSelectedMunicipalityCode: vi.fn(),
    });
    useMapLayerViewStateMock.mockReturnValue({
      spatialSelection: { spatialArea: "national", spatialValue: "brasil" },
    });
  });

  afterEach(() => {
    cleanup();
  });

  // Regressão: voltar do detalhamento de um índice remontava a listagem com
  // todos os acordeões fechados, como se nada tivesse sido aberto.
  it("mantém o acordeão aberto depois de sair e voltar do detalhamento", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ListingRoundTrip mounted />);

    await user.click(screen.getByText("Dados Ambientais"));
    expect(
      screen.getByText("Dados Ambientais").closest("button"),
    ).toHaveAttribute("aria-expanded", "true");

    rerender(<ListingRoundTrip mounted={false} />);
    rerender(<ListingRoundTrip mounted />);

    expect(
      screen.getByText("Dados Ambientais").closest("button"),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("devolve a rolagem que o painel tinha antes de abrir o índice", async () => {
    const { container, rerender } = render(<ListingRoundTrip mounted />);
    const scrollArea = container.querySelector(
      ".overflow-y-auto",
    ) as HTMLDivElement;

    scrollArea.scrollTop = 320;
    scrollArea.dispatchEvent(new Event("scroll", { bubbles: true }));

    rerender(<ListingRoundTrip mounted={false} />);
    rerender(<ListingRoundTrip mounted />);

    const restored = container.querySelector(
      ".overflow-y-auto",
    ) as HTMLDivElement;
    expect(restored.scrollTop).toBe(320);
  });
});
