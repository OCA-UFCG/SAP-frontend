import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SpatialScopeSelect } from "@/components/SpatialScopeSelect/SpatialScopeSelect";


afterEach(() => {
  cleanup();
});

describe("SpatialScopeSelect", () => {
  it("exposes localized accessible spatial selectors and emits canonical values", async () => {
    const user = userEvent.setup();
    const onSpatialSelectionChange = vi.fn();

    render(
      <SpatialScopeSelect
        spatialSelection={{ spatialArea: "national", spatialValue: "brasil" }}
        onSpatialSelectionChange={onSpatialSelectionChange}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Área: Nacional" })
    );
    expect(
      screen.getByRole("listbox", { name: "Área" })
    ).toBeVisible();
    await user.click(screen.getByRole("option", { name: "Regional" }));

    expect(onSpatialSelectionChange).toHaveBeenCalledWith({
      spatialArea: "region",
      spatialValue: "Norte",
    });
  });

  it("offers Município between Estado and Bioma and turns Recorte into a search", async () => {
    const user = userEvent.setup();
    const onSpatialSelectionChange = vi.fn();
    const onSelect = vi.fn();

    render(
      <SpatialScopeSelect
        spatialSelection={{ spatialArea: "state", spatialValue: "Paraíba" }}
        onSpatialSelectionChange={onSpatialSelectionChange}
        municipality={{ code: null, onSelect, onClear: vi.fn() }}
      />
    );

    await user.click(screen.getByRole("button", { name: "Área: Estado" }));
    const options = screen
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options.slice(2, 5)).toEqual(["Estado", "Município", "Bioma"]);

    await user.click(screen.getByRole("option", { name: "Município" }));
    // A cidade é vista sobre o Brasil inteiro.
    expect(onSpatialSelectionChange).toHaveBeenCalledWith({
      spatialArea: "national",
      spatialValue: "brasil",
    });

    const search = screen.getByRole("combobox", { name: "Recorte" });
    await user.type(search, "Campina Gr");
    await user.click(screen.getByRole("option", { name: "Campina Grande - PB" }));

    expect(onSelect).toHaveBeenCalledWith("2504009", "pb");
  });

  it("shows the chosen municipality and lets it be cleared", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();

    render(
      <SpatialScopeSelect
        spatialSelection={{ spatialArea: "national", spatialValue: "brasil" }}
        onSpatialSelectionChange={vi.fn()}
        municipality={{ code: "2504009", onSelect: vi.fn(), onClear }}
      />
    );

    expect(screen.getByRole("button", { name: "Área: Município" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Recorte" })).toHaveValue(
      "Campina Grande - PB",
    );
    await user.click(screen.getByRole("button", { name: "Limpar município" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("keeps the old options when there is no municipality scope", async () => {
    const user = userEvent.setup();

    render(
      <SpatialScopeSelect
        spatialSelection={{ spatialArea: "national", spatialValue: "brasil" }}
        onSpatialSelectionChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Área: Nacional" }));
    expect(
      screen.queryByRole("option", { name: "Município" }),
    ).not.toBeInTheDocument();
  });
});
