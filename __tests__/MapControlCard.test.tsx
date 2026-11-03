import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MapControlDisclosure } from "@/components/MapControls/MapControlCard";
import { PlatformMapCaption } from "@/components/PlatformMapCaption/PlatformMapCaption";
import { ReferenceOverlaysControl } from "@/components/MapControls/ReferenceOverlaysControl";
import {
  REFERENCE_LAYER_IDS,
  REFERENCE_LAYER_SWATCHES,
} from "@/components/MapLayerContext/mapLayerState";

describe("MapControlDisclosure", () => {
  afterEach(cleanup);

  it("starts collapsed and reveals the content on the header click", () => {
    render(
      <MapControlDisclosure label="Legendas">
        {() => <p>conteúdo</p>}
      </MapControlDisclosure>,
    );

    expect(screen.queryByText("conteúdo")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Legendas" }));
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
  });

  it("avisa quando o cartão abre, e não quando fecha", () => {
    const onOpen = vi.fn();
    render(
      <MapControlDisclosure label="Territórios" onOpen={onOpen}>
        {() => <p>conteúdo</p>}
      </MapControlDisclosure>,
    );
    const header = screen.getByRole("button", { name: "Territórios" });

    fireEvent.click(header);
    fireEvent.click(header);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("nasce aberto com defaultOpen e ainda fecha pelo cabeçalho", () => {
    render(
      <MapControlDisclosure label="Legendas" defaultOpen>
        {() => <p>conteúdo</p>}
      </MapControlDisclosure>,
    );

    expect(screen.getByText("conteúdo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Legendas" }));
    expect(screen.queryByText("conteúdo")).not.toBeInTheDocument();
  });

  it("mostra a legenda aberta assim que um índice é ligado", () => {
    render(
      <PlatformMapCaption legend={[{ label: "Seca fraca", color: "#ff0" }]} />,
    );

    expect(screen.getByRole("button", { name: "Legendas" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("Seca fraca")).toBeInTheDocument();
  });

  it("gives Territórios and Legendas the same card, so they stop diverging", () => {
    const { container: overlays } = render(
      <ReferenceOverlaysControl
        activeOverlays={new Set()}
        onToggle={() => {}}
        highlightedOverlay={null}
        onToggleHighlight={() => {}}
        onSelectTerritory={() => {}}
      />,
    );
    const { container: caption } = render(
      <PlatformMapCaption legend={[{ label: "Seca fraca", color: "#ff0" }]} />,
    );
    // Legendas nasce aberta; fechado, o cartão encolhe no celular.
    fireEvent.click(screen.getByRole("button", { name: "Territórios" }));

    expect(overlays.firstElementChild?.className).toBe(
      caption.firstElementChild?.className,
    );
  });

  it("paints each territory row with that territory's map color", () => {
    render(
      <ReferenceOverlaysControl
        activeOverlays={new Set()}
        onToggle={() => {}}
        highlightedOverlay={null}
        onToggleHighlight={() => {}}
        onSelectTerritory={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Territórios" }));

    const rows = screen.getAllByRole("listitem");
    REFERENCE_LAYER_IDS.forEach((layerId, index) => {
      expect(rows[index].style.getPropertyValue("--swatch")).toBe(
        REFERENCE_LAYER_SWATCHES[layerId].fill,
      );
    });
  });
});

describe("camadas no cartão de Territórios", () => {
  afterEach(cleanup);

  it("liga cada camada por um switch com o nome dela", () => {
    const onToggle = vi.fn();
    render(
      <ReferenceOverlaysControl
        activeOverlays={new Set(["terras_indigenas"])}
        onToggle={onToggle}
        highlightedOverlay={null}
        onToggleHighlight={() => {}}
        onSelectTerritory={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Territórios" }));

    expect(screen.getAllByRole("switch")).toHaveLength(4);
    expect(
      screen.getByRole("switch", { name: "Terras Indígenas" }),
    ).toHaveAttribute("aria-checked", "true");
    const settlements = screen.getByRole("switch", { name: "Assentamentos" });
    expect(settlements).toHaveAttribute("aria-checked", "false");

    fireEvent.click(settlements);

    expect(onToggle).toHaveBeenCalledWith("assentamentos");
  });

  it("destaca cada camada por um botão de alternância", () => {
    const onToggleHighlight = vi.fn();
    render(
      <ReferenceOverlaysControl
        activeOverlays={new Set(["terras_indigenas"])}
        onToggle={() => {}}
        highlightedOverlay="terras_indigenas"
        onToggleHighlight={onToggleHighlight}
        onSelectTerritory={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Territórios" }));

    expect(
      screen.getByRole("button", { name: "Destacar Terras Indígenas" }),
    ).toHaveAttribute("aria-pressed", "true");
    const settlements = screen.getByRole("button", {
      name: "Destacar Assentamentos",
    });
    expect(settlements).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(settlements);

    expect(onToggleHighlight).toHaveBeenCalledWith("assentamentos");
  });

  it("pede o pré-carregamento ao abrir o cartão", () => {
    const onOpen = vi.fn();
    render(
      <ReferenceOverlaysControl
        activeOverlays={new Set()}
        onToggle={() => {}}
        highlightedOverlay={null}
        onToggleHighlight={() => {}}
        onSelectTerritory={() => {}}
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Territórios" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
