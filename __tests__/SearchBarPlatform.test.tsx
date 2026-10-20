import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/services/telemetry/client", () => ({
  trackUiEvent: vi.fn(),
}));

import SearchBarPlatform from "@/components/SidePanelContexts/SearchBarPlatform";
import { trackUiEvent } from "@/services/telemetry/client";

vi.mock("@/utils/functions", () => ({
  normalize: (value: string) => value.toLowerCase().replace(/\s+/g, ""),
}));

vi.mock("@/utils/constants", () => ({
  statesObj: {
    sp: "sao paulo",
    rj: "rio de janeiro",
  },
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

describe("SearchBarPlatform", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  const mockedTrackUiEvent = vi.mocked(trackUiEvent);

  const renderComponent = (selectedLocationKey?: string) => {
    const onSearch = vi.fn();
    const telemetryContext = {
      activeLayerId: "layer-1",
      activeLayerName: "Camada Teste",
      activeDateLabel: "2024",
    };
    const { rerender } = render(
      <SearchBarPlatform
        onSearch={onSearch}
        searchTelemetryContext={telemetryContext}
        selectedLocationKey={selectedLocationKey}
      />,
    );
    const selectLocation = (key: string) =>
      rerender(
        <SearchBarPlatform
          onSearch={onSearch}
          searchTelemetryContext={telemetryContext}
          selectedLocationKey={key}
        />,
      );
    return { onSearch, selectLocation };
  };

  it("filters dropdown options while typing", async () => {
    const user = userEvent.setup();
    renderComponent();

    const input = screen.getByRole("combobox");

    await user.type(input, "rio");

    expect(
      screen.getByRole("option", { name: "rio de janeiro" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("option", { name: "sao paulo" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the chosen name and closes the keyboard when an option is selected", async () => {
    const user = userEvent.setup();
    const { onSearch } = renderComponent();

    const input = screen.getByRole("combobox");

    await user.type(input, "rio");
    await user.click(screen.getByRole("option", { name: "rio de janeiro" }));

    expect(onSearch).toHaveBeenCalledWith(
      "rio de janeiro",
      expect.objectContaining({
        selectionMethod: "option-click",
      }),
    );
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue("rio de janeiro");
    expect(input).not.toHaveFocus();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("keeps the name when the panel confirms the chosen location", async () => {
    const user = userEvent.setup();
    const { selectLocation } = renderComponent("br");

    await user.type(screen.getByRole("combobox"), "camp");
    await user.click(
      screen.getByRole("option", { name: "Campina Grande - PB" }),
    );
    selectLocation("2504009");

    expect(screen.getByRole("combobox")).toHaveValue("Campina Grande - PB");
  });

  it("clears the name when another location is chosen outside the search", async () => {
    const user = userEvent.setup();
    const { selectLocation } = renderComponent("br");

    await user.type(screen.getByRole("combobox"), "rio");
    await user.click(screen.getByRole("option", { name: "rio de janeiro" }));
    selectLocation("rj");
    expect(screen.getByRole("combobox")).toHaveValue("rio de janeiro");

    selectLocation("sp");
    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("selects the first suggestion when Enter is pressed", async () => {
    const user = userEvent.setup();
    const { onSearch } = renderComponent();

    const input = screen.getByRole("combobox");

    await user.type(input, "camp");
    await user.keyboard("{Enter}");

    expect(onSearch).toHaveBeenCalledWith(
      "Campina Grande - PB",
      expect.objectContaining({
        selectionMethod: "enter",
      }),
    );
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("shows error message when invalid value is submitted (Platform)", async () => {
    const user = userEvent.setup();
    renderComponent();

    const input = screen.getByRole("combobox");
    const button = screen.getByRole("button", { name: /pesquisar/i });

    await user.type(input, "invalid");
    await user.click(button);

    expect(
      screen.getByText("Estado ou município não identificado."),
    ).toBeInTheDocument();
    expect(mockedTrackUiEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "search_not_found",
        surface: "analysis-panel",
        query: "invalid",
        selectionMethod: "button",
        activeLayerId: "layer-1",
        activeDateLabel: "2024",
      }),
    );
  });
});
