import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/services/telemetry/client", () => ({
  trackUiEvent: vi.fn(),
}));

import SearchBar from "@/components/SearchBar/SearchBar";
import { trackUiEvent } from "@/services/telemetry/client";

// --- Mock dependencies ---
vi.mock("@/utils/functions", () => ({
  normalize: (value: string) => value.toLowerCase(),
}));

vi.mock("@/utils/constants", () => ({
  statesObj: { sp: "sao paulo", rj: "rio de janeiro" },
  states: new Set(["sao paulo", "rio de janeiro"]),
  ufs: new Set(["sp", "rj"]),
}));

vi.mock("@/data/citiesIndex.json", () => ({
  default: [
    {
      code: "2504009",
      label: "Campina Grande - PB",
      name: "Campina Grande",
      uf: "pb",
    },
  ],
}));

describe("SearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup(); // ensures DOM reset
  });

  const mockedTrackUiEvent = vi.mocked(trackUiEvent);

  const renderComponent = () => {
    const onSearch = vi.fn();
    render(
      <SearchBar
        onSearch={onSearch}
        searchTelemetryContext={{
          activeLayerId: "CDI",
          activeLayerName: "CDI Janeiro 2024",
          activeDateLabel: "31/01/24",
        }}
      />,
    );
    return { onSearch };
  };

  it("renders input and button", () => {
    renderComponent();

    expect(screen.getByRole("combobox")).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /pesquisar/i }),
    ).toBeInTheDocument();
  });

  it("calls onSearch when valid state name is submitted", async () => {
    const user = userEvent.setup();
    const { onSearch } = renderComponent();

    const input = screen.getByRole("combobox");
    const button = screen.getByRole("button", { name: /pesquisar/i });

    await user.type(input, "sao paulo");
    await user.click(button);

    expect(onSearch).toHaveBeenCalledWith(
      "sao paulo",
      expect.objectContaining({
        selectionMethod: "button",
      }),
    );
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("calls onSearch when valid UF is submitted", async () => {
    const user = userEvent.setup();
    const { onSearch } = renderComponent();

    const input = screen.getByRole("combobox");
    const button = screen.getByRole("button", { name: /pesquisar/i });

    await user.type(input, "sp");
    await user.click(button);

    expect(onSearch).toHaveBeenCalledWith(
      "sp",
      expect.objectContaining({
        selectionMethod: "button",
      }),
    );
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("does not show inline error text when invalid value is submitted (Home)", async () => {
    const user = userEvent.setup();
    renderComponent();

    const input = screen.getByRole("combobox");
    const button = screen.getByRole("button", { name: /pesquisar/i });

    await user.type(input, "invalid");
    await user.click(button);

    expect(
      screen.queryByText("Estado não identificado."),
    ).not.toBeInTheDocument();
    expect(mockedTrackUiEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "search_not_found",
        surface: "home",
        query: "invalid",
        selectionMethod: "button",
        activeLayerId: "CDI",
        activeDateLabel: "31/01/24",
      }),
    );
  });

  it("filters dropdown options while typing", async () => {
    const user = userEvent.setup();
    renderComponent();

    const input = screen.getByRole("combobox");

    await user.type(input, "sao");

    expect(screen.getByRole("option", { name: "sao paulo" })).toBeVisible();
    expect(
      screen.queryByRole("option", { name: "rio de janeiro" }),
    ).not.toBeInTheDocument();
  });

  it("tracks municipality queries as not found on home", async () => {
    const user = userEvent.setup();
    const { onSearch } = renderComponent();

    const input = screen.getByRole("combobox");
    const button = screen.getByRole("button", { name: /pesquisar/i });

    await user.type(input, "campina");
    await user.click(button);

    expect(onSearch).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("option", { name: "Campina Grande - PB" }),
    ).not.toBeInTheDocument();
    expect(mockedTrackUiEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "search_not_found",
        surface: "home",
        query: "campina",
        selectionMethod: "button",
        activeLayerId: "CDI",
        activeDateLabel: "31/01/24",
      }),
    );
  });

  it("selects the first suggestion when Enter is pressed", async () => {
    const user = userEvent.setup();
    const { onSearch } = renderComponent();

    const input = screen.getByRole("combobox");

    await user.type(input, "sao");
    await user.keyboard("{Enter}");

    expect(onSearch).toHaveBeenCalledWith(
      "sao paulo",
      expect.objectContaining({
        selectionMethod: "enter",
      }),
    );
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("shows Brasil as the first option in the dropdown", async () => {
    const user = userEvent.setup();
    renderComponent();

    const toggle = screen.getByRole("button", { name: /mostrar estados/i });

    await user.click(toggle);

    const options = screen.getAllByRole("option");

    expect(options[0]).toHaveTextContent("Brasil");
  });
});
