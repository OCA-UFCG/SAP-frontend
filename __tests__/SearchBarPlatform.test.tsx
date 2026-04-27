import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchBarPlatform from "@/components/SidePanelContexts/SearchBarPlatform";

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

describe("SearchBarPlatform", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  const renderComponent = () => {
    const onSearch = vi.fn();
    render(<SearchBarPlatform onSearch={onSearch} />);
    return { onSearch };
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

  it("submits and clears the input when an option is selected", async () => {
    const user = userEvent.setup();
    const { onSearch } = renderComponent();

    const input = screen.getByRole("combobox");

    await user.type(input, "rio");
    await user.click(screen.getByRole("option", { name: "rio de janeiro" }));

    expect(onSearch).toHaveBeenCalledWith("rio de janeiro");
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
