import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageSwitcher } from "@/components/LanguageSwitcher/LanguageSwitcher";

const replaceMock = vi.fn();
const usePathnameMock = vi.fn();

vi.mock("@/translations/routing", () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    usePathnameMock.mockReset();
    usePathnameMock.mockReturnValue("/sobre-o-sedes");
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the language selector with the active locale", () => {
    render(<LanguageSwitcher />);

    expect(
      screen.getByRole("button", { name: /alterar idioma/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("pt")).toBeInTheDocument();
  });

  it("toggles the language menu and shows language options", () => {
    render(<LanguageSwitcher />);

    const langBtn = screen.getByRole("button", { name: /alterar idioma/i });
    fireEvent.click(langBtn);

    expect(screen.getByText("Português")).toBeInTheDocument();
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Español")).toBeInTheDocument();
  });

  it("calls router.replace with selected language when clicked", () => {
    render(<LanguageSwitcher />);

    const langBtn = screen.getByRole("button", { name: /alterar idioma/i });
    fireEvent.click(langBtn);

    const enOption = screen.getByText("English");
    fireEvent.click(enOption);

    expect(replaceMock).toHaveBeenCalledWith("/sobre-o-sedes", { locale: "en" });
  });

  it("closes the dropdown when clicked outside", () => {
    render(<LanguageSwitcher />);

    const langBtn = screen.getByRole("button", { name: /alterar idioma/i });
    fireEvent.click(langBtn);
    expect(screen.getByText("English")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("English")).not.toBeInTheDocument();
  });
});
