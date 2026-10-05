import { afterEach, describe, expect, it } from "vitest";
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

  it("gives Territórios and Legendas the same card, so they stop diverging", () => {
    const { container: overlays } = render(
      <ReferenceOverlaysControl
        activeOverlays={new Set()}
        onToggle={() => {}}
        onSelectTerritory={() => {}}
      />,
    );
    const { container: caption } = render(
      <PlatformMapCaption legend={[{ label: "Seca fraca", color: "#ff0" }]} />,
    );

    expect(overlays.firstElementChild?.className).toBe(
      caption.firstElementChild?.className,
    );
  });

  it("paints each territory checkbox with that territory's map color", () => {
    render(
      <ReferenceOverlaysControl
        activeOverlays={new Set()}
        onToggle={() => {}}
        onSelectTerritory={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Territórios" }));

    const checkboxes = screen.getAllByRole("checkbox");
    REFERENCE_LAYER_IDS.forEach((layerId, index) => {
      const swatch = REFERENCE_LAYER_SWATCHES[layerId];
      const style = checkboxes[index].style;
      expect(style.getPropertyValue("--swatch-outline")).toBe(swatch.outline);
      expect(style.getPropertyValue("--swatch-fill")).toBe(swatch.fill);
    });
  });
});
