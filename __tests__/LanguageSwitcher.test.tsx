import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
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

  it("renders the language selector with the active language spelled out", () => {
    render(<LanguageSwitcher />);

    const langBtn = screen.getByRole("button", { name: /alterar idioma/i });

    expect(langBtn).toBeInTheDocument();
    expect(langBtn).toHaveTextContent("Português");
  });

  it("toggles the language menu and shows language options", () => {
    render(<LanguageSwitcher />);

    const langBtn = screen.getByRole("button", { name: /alterar idioma/i });
    fireEvent.click(langBtn);

    const options = screen.getByRole("listbox");

    expect(within(options).getByText("Português")).toBeInTheDocument();
    expect(within(options).getByText("English")).toBeInTheDocument();
    expect(within(options).getByText("Español")).toBeInTheDocument();
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
