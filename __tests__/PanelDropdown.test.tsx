import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PanelDropdown } from "@/components/PanelDropdown/PanelDropdown";

const OPTIONS = [
  { value: "municipality", label: "Município" },
  { value: "state", label: "Estado" },
];

afterEach(() => {
  vi.restoreAllMocks();
});

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

    await user.click(
      screen.getByRole("button", { name: "Recorte: Município" }),
    );
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

  it("opens the list scrolled to the selected option", async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.getAttribute("aria-selected") === "true" ? 400 : 0;
      },
    );
    render(
      <PanelDropdown
        label="Recorte"
        options={OPTIONS}
        value="state"
        placeholder="Selecione"
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Recorte: Estado" }));

    expect(screen.getByRole("listbox").scrollTop).toBe(400);
  });

  it("works from the keyboard: arrows move, Escape closes and returns focus", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <PanelDropdown
        label="Recorte"
        options={OPTIONS}
        value="municipality"
        placeholder="Selecione"
        onChange={onChange}
      />,
    );
    const view = within(container);
    const trigger = view.getByRole("button", { name: "Recorte: Município" });

    trigger.focus();
    await user.keyboard("{Enter}");
    expect(view.getByRole("option", { name: "Município" })).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(view.getByRole("option", { name: "Estado" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(view.getByRole("option", { name: "Município" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(view.getByRole("option", { name: "Estado" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(view.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });
});
