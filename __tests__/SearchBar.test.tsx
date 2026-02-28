import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchBar from "@/components/SearchBar/SearchBar";

// --- Mock dependencies ---
vi.mock("@/utils/functions", () => ({
  normalize: (value: string) => value.toLowerCase(),
}));

vi.mock("@/utils/constants", () => ({
  states: new Set(["sao paulo", "rio de janeiro"]),
  ufs: new Set(["sp", "rj"]),
}));

describe("SearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup(); // ensures DOM reset
  });

  const renderComponent = () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);
    return { onSearch };
  };

  it("renders input and button", () => {
    renderComponent();

    expect(
      screen.getByPlaceholderText("Pesquise uma cidade ou estado")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /pesquisar/i })
    ).toBeInTheDocument();
  });

  it("calls onSearch when valid state name is submitted", async () => {
    const user = userEvent.setup();
    const { onSearch } = renderComponent();

    const input = screen.getByPlaceholderText(
      "Pesquise uma cidade ou estado"
    );
    const button = screen.getByRole("button", { name: /pesquisar/i });

    await user.type(input, "sao paulo");
    await user.click(button);

    expect(onSearch).toHaveBeenCalledWith("sao paulo");
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("calls onSearch when valid UF is submitted", async () => {
    const user = userEvent.setup();
    const { onSearch } = renderComponent();

    const input = screen.getByPlaceholderText(
      "Pesquise uma cidade ou estado"
    );
    const button = screen.getByRole("button", { name: /pesquisar/i });

    await user.type(input, "sp");
    await user.click(button);

    expect(onSearch).toHaveBeenCalledWith("sp");
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("shows error message when invalid value is submitted", async () => {
    const user = userEvent.setup();
    renderComponent();

    const input = screen.getByPlaceholderText(
      "Pesquise uma cidade ou estado"
    );
    const button = screen.getByRole("button", { name: /pesquisar/i });

    await user.type(input, "invalid");
    await user.click(button);

    expect(
      screen.getByText("Estado não identificado.")
    ).toBeInTheDocument();
  });
});