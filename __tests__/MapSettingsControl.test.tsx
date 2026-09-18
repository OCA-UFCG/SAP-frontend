import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MapSettingsControl } from "@/components/MapControls/MapSettingsControl";

describe("MapSettingsControl", () => {
  afterEach(cleanup);

  it("keeps the map settings collapsed until the button is clicked", () => {
    render(<MapSettingsControl basemap="osm" onBasemapChange={vi.fn()} />);

    expect(
      screen.queryByRole("group", { name: "Mapa base" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ajustes do mapa" }));

    expect(
      screen.getByRole("group", { name: "Mapa base" }),
    ).toBeInTheDocument();
  });

  it("offers the opacity slider only when a layer can be faded", () => {
    const onOpacityChange = vi.fn();
    const { rerender } = render(
      <MapSettingsControl basemap="osm" onBasemapChange={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ajustes do mapa" }));

    expect(
      screen.queryByRole("slider", { name: "Transparência" }),
    ).not.toBeInTheDocument();

    rerender(
      <MapSettingsControl
        basemap="osm"
        onBasemapChange={vi.fn()}
        opacity={0.5}
        onOpacityChange={onOpacityChange}
      />,
    );

    expect(screen.getByRole("slider", { name: "Transparência" })).toHaveValue(
      "0.5",
    );
  });

  it("closes when the person clicks the map behind it", () => {
    render(<MapSettingsControl basemap="osm" onBasemapChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Ajustes do mapa" }));
    fireEvent.pointerDown(document.body);

    expect(
      screen.queryByRole("group", { name: "Mapa base" }),
    ).not.toBeInTheDocument();
  });
});
