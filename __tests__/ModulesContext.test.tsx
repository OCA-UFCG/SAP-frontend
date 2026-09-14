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
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
    return <img alt={alt} {...props} />;
  },
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
  DroughtDataset: ({
    card,
    onToggle,
    onDetails,
  }: {
    card: { title: string; description: string };
    onToggle?: () => void;
    onDetails?: () => void;
  }) => {
    return (
      <article>
        <h3>{card.title}</h3>
        <p>{card.description}</p>
        <button type="button" onClick={onToggle}>
          Alternar {card.title}
        </button>
        <button type="button" onClick={onDetails}>
          Detalhar {card.title}
        </button>
      </article>
    );
  },
}));

import { ModulesContext } from "@/components/SidePanelContexts/ModulesContext";
import { trackUiEvent } from "@/services/telemetry/client";
import type { PanelLayerI } from "@/utils/interfaces";

describe("ModulesContext", () => {
  beforeEach(() => {
    useMapLayerActiveStateMock.mockReset();
    useMapLayerActionsMock.mockReset();
    useMapLayerViewStateMock.mockReset();
    vi.mocked(trackUiEvent).mockReset();

    useMapLayerActiveStateMock.mockReturnValue({
      activeData: null,
      activeEEData: null,
    });
    useMapLayerActionsMock.mockReturnValue({
      activateVectorLayer: vi.fn(),
      activateEeLayer: vi.fn(),
      clearActiveLayer: vi.fn(),
      setSpatialSelection: vi.fn(),
    });
    useMapLayerViewStateMock.mockReturnValue({
      spatialSelection: { spatialArea: "national", spatialValue: "brasil" },
    });
  });

  afterEach(() => {
    cleanup();
  });

  // Regressao: o seletor ficou invisivel em producao porque dependia da flag
  // NEXT_PUBLIC_ENABLE_SPATIAL_SCOPE, que nao era injetada no build de producao.
  it("renders the spatial scope selector without depending on any rollout flag", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_SPATIAL_SCOPE", "");

    render(<ModulesContext activeSection="analysis" panelLayers={[]} />);

    expect(
      screen.getByRole("button", { name: "Recorte espacial: Nacional" }),
    ).toBeInTheDocument();

    vi.unstubAllEnvs();
  });

  it("groups panel layers by their Contentful category and starts every group closed", () => {
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
      {
        sys: { id: "sys-livre" },
        id: "layer-livre",
        name: "Camada Livre",
        description: "Descricao livre",
        category: "Categoria Livre",
        panelPosition: 2,
        previewMap: { url: "https://example.com/livre.png" },
        imageData: {},
      },
    ];

    render(
      <ModulesContext activeSection="analysis" panelLayers={panelLayers} />,
    );

    const ambientalAccordion = screen
      .getByText("Dados Ambientais")
      .closest("button");
    const livreAccordion = screen
      .getByText("Categoria Livre")
      .closest("button");

    expect(ambientalAccordion).toHaveAttribute("aria-expanded", "false");
    expect(livreAccordion).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Camada Ambiental")).toBeInTheDocument();
    expect(screen.getByText("Camada Livre")).toBeInTheDocument();
  });

  it("abre o detalhamento do índice pedido pela URL, ativando a camada no mapa", () => {
    const onRequestSectionChange = vi.fn();
    const panelLayers: PanelLayerI[] = [
      {
        sys: { id: "sys-seca" },
        id: "anaseca",
        name: "Monitor de Secas",
        description: "Descricao",
        category: "Dados Climáticos",
        panelPosition: 1,
        previewMap: { url: "https://example.com/seca.png" },
        imageData: { years: {} },
      },
    ];

    render(
      <ModulesContext
        activeSection="monitoring"
        panelLayers={panelLayers}
        detailLayerId="anaseca"
        onRequestSectionChange={onRequestSectionChange}
      />,
    );

    expect(onRequestSectionChange).toHaveBeenCalledWith("analysis-detail");
  });

  it("ignora um id de camada que não existe, em vez de abrir painel vazio", () => {
    const onRequestSectionChange = vi.fn();

    render(
      <ModulesContext
        activeSection="monitoring"
        panelLayers={[]}
        detailLayerId="camada-inexistente"
        onRequestSectionChange={onRequestSectionChange}
      />,
    );

    expect(onRequestSectionChange).not.toHaveBeenCalled();
  });

  it("uses Outros when category is missing and still renders it", () => {
    const panelLayers: PanelLayerI[] = [
      {
        sys: { id: "sys-sem-categoria" },
        id: "layer-sem-categoria",
        name: "Camada Sem Categoria",
        description: "Descricao sem categoria",
        previewMap: { url: "https://example.com/sem-categoria.png" },
        imageData: {},
      },
    ];

    render(
      <ModulesContext activeSection="analysis" panelLayers={panelLayers} />,
    );

    expect(screen.getByText("Outros").closest("button")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByText("Camada Sem Categoria")).toBeInTheDocument();
  });

  // Regressão: "Dados Climáticos" é a primeira categoria da ordem fixa e vinha
  // aberta por default, deixando o painel de Monitoramento já rolado.
  it("keeps Dados Climáticos closed even though it is the first category", () => {
    const panelLayers: PanelLayerI[] = [
      {
        sys: { id: "sys-climatico" },
        id: "layer-climatico",
        name: "Camada Climática",
        description: "Descricao climatica",
        category: "Dados Climáticos",
        panelPosition: 1,
        previewMap: { url: "https://example.com/climatico.png" },
        imageData: {},
      },
    ];

    render(
      <ModulesContext activeSection="analysis" panelLayers={panelLayers} />,
    );

    expect(
      screen.getByText("Dados Climáticos").closest("button"),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("tracks vector layer activation when a layer toggle is turned on", async () => {
    const user = userEvent.setup();
    const activateVectorLayer = vi.fn();

    useMapLayerActionsMock.mockReturnValue({
      activateVectorLayer,
      activateEeLayer: vi.fn(),
      clearActiveLayer: vi.fn(),
      setSpatialSelection: vi.fn(),
    });

    render(
      <ModulesContext
        activeSection="analysis"
        panelLayers={[
          {
            sys: { id: "sys-cdi" },
            id: "CDI",
            name: "CDI Janeiro 2024",
            description: "Descricao CDI",
            category: "Dados Climáticos",
            panelPosition: 1,
            previewMap: { url: "https://example.com/cdi.png" },
            imageData: {},
          },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Alternar CDI Janeiro 2024" }),
    );

    expect(activateVectorLayer).toHaveBeenCalledTimes(1);
    expect(trackUiEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "layer_toggled",
        surface: "analysis-panel",
        activeLayerId: "CDI",
        activeLayerName: "CDI Janeiro 2024",
        layerKind: "vector",
        action: "activated",
        activeSection: "analysis",
      }),
    );
  });

  it("tracks only layer detail openings when detalhe is clicked", async () => {
    const user = userEvent.setup();
    const activateEeLayer = vi.fn();
    const onRequestSectionChange = vi.fn();

    useMapLayerActionsMock.mockReturnValue({
      activateVectorLayer: vi.fn(),
      activateEeLayer,
      clearActiveLayer: vi.fn(),
      setSpatialSelection: vi.fn(),
    });

    render(
      <ModulesContext
        activeSection="analysis"
        onRequestSectionChange={onRequestSectionChange}
        panelLayers={[
          {
            sys: { id: "sys-ee" },
            id: "ee-layer-1",
            name: "Camada EE",
            description: "Descricao EE",
            category: "Dados Ambientais",
            panelPosition: 1,
            previewMap: { url: "https://example.com/ee.png" },
            imageData: {},
          },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Detalhar Camada EE" }),
    );

    expect(activateEeLayer).toHaveBeenCalledTimes(1);
    expect(onRequestSectionChange).toHaveBeenCalledWith("analysis-detail");
    expect(trackUiEvent).toHaveBeenCalledTimes(1);
    expect(trackUiEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "layer_details_opened",
        surface: "analysis-panel",
        activeLayerId: "ee-layer-1",
        activeLayerName: "Camada EE",
        layerKind: "ee",
        activeSection: "analysis",
      }),
    );
  });
});
