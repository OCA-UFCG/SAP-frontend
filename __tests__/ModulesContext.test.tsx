import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type React from "react";

const useMapLayerActiveStateMock = vi.fn();
const useMapLayerActionsMock = vi.fn();

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
    return <img alt={alt} {...props} />;
  },
}));

vi.mock("@/components/MapLayerContext/MapLayerContext", () => ({
  useMapLayerActiveState: () => useMapLayerActiveStateMock(),
  useMapLayerActions: () => useMapLayerActionsMock(),
}));

vi.mock("@/utils/imageData", () => ({
  getImageDataLegend: vi.fn(() => null),
}));

import { ModulesContext } from "@/components/SidePanelContexts/ModulesContext";
import type { PanelLayerI } from "@/utils/interfaces";

describe("ModulesContext", () => {
  beforeEach(() => {
    useMapLayerActiveStateMock.mockReset();
    useMapLayerActionsMock.mockReset();

    useMapLayerActiveStateMock.mockReturnValue({
      activeData: null,
      activeEEData: null,
    });
    useMapLayerActionsMock.mockReturnValue({
      activateVectorLayer: vi.fn(),
      activateEeLayer: vi.fn(),
      clearActiveLayer: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("groups panel layers by their Contentful category and opens the first visible group", () => {
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

    const ambientalAccordion = screen.getByRole("button", {
      name: "Dados Ambientais",
    });
    const livreAccordion = screen.getByRole("button", {
      name: "Categoria Livre",
    });

    expect(ambientalAccordion).toHaveAttribute("aria-expanded", "true");
    expect(livreAccordion).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Camada Ambiental")).toBeVisible();
    expect(screen.getByText("Camada Livre")).toBeVisible();
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

    expect(
      screen.getByRole("button", { name: "Outros" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Camada Sem Categoria")).toBeVisible();
  });
});
