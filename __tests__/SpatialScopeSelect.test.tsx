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
      screen.getByRole("button", { name: "Recorte espacial: Nacional" })
    );
    expect(
      screen.getByRole("listbox", { name: "Recorte espacial" })
    ).toBeVisible();
    await user.click(screen.getByRole("option", { name: "Regional" }));

    expect(onSpatialSelectionChange).toHaveBeenCalledWith({
      spatialArea: "region",
      spatialValue: "Norte",
    });
  });
});
