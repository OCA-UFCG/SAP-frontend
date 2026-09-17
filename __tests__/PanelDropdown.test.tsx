import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PanelDropdown } from "@/components/PanelDropdown/PanelDropdown";

const OPTIONS = [
  { value: "municipality", label: "Município" },
  { value: "state", label: "Estado" },
];

describe("PanelDropdown", () => {
  it("shows the selected label and emits the chosen value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PanelDropdown
        label="Recorte"
        options={OPTIONS}
        value="municipality"
        placeholder="Selecione"
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Recorte: Município" }));
    await user.click(screen.getByRole("option", { name: "Estado" }));

    expect(onChange).toHaveBeenCalledWith("state");
  });

  it("falls back to the placeholder when nothing is selected", () => {
    render(
      <PanelDropdown
        label="Recorte"
        options={OPTIONS}
        value=""
        placeholder="Selecione o território"
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Recorte: Selecione o território" }),
    ).toBeInTheDocument();
  });
});
