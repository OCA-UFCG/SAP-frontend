import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MenuModal } from "@/components/MenuModal/MenuModal";
import { ISection } from "@/utils/interfaces";

const replaceMock = vi.fn();
const usePathnameMock = vi.fn();

vi.mock("@/translations/routing", () => ({
  // Sem repassar o `prefetch`, que não é atributo de `<a>`.
  Link: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    prefetch?: boolean;
  }) => {
    delete props.prefetch;
    return React.createElement("a", { href, ...props }, children);
  },
  usePathname: () => usePathnameMock(),
  useRouter: () => ({ replace: replaceMock }),
}));

const content: ISection[] = [
  {
    id: "1",
    name: "Início",
    path: "/",
    appears: true,
    childrenCollection: {
      items: [
        {
          id: "1-1",
          name: "A Plataforma",
          path: "/#a-plataforma",
          appears: true,
        },
        { id: "1-2", name: "Novidades", path: "/#novidades", appears: true },
      ],
    },
  },
  { id: "2", name: "Glossário", path: "/glossary", appears: true },
  { id: "3", name: "Plataforma", path: "/platform", appears: true },
];

const menuButton = () => screen.getByRole("button", { name: /menu/i });
const isOpen = () => menuButton().getAttribute("aria-expanded") === "true";

describe("MenuModal", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    usePathnameMock.mockReturnValue("/");
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("opens below the bar and locks the page scroll while open", () => {
    render(<MenuModal content={content} />);
    expect(menuButton()).toHaveAccessibleName("Abrir menu");

    fireEvent.click(menuButton());

    expect(isOpen()).toBe(true);
    expect(menuButton()).toHaveAccessibleName("Fechar menu");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("closes when a link is chosen, so a section of the same page shows up", () => {
    render(<MenuModal content={content} />);
    fireEvent.click(menuButton());

    fireEvent.click(screen.getByRole("link", { name: "Glossário" }));

    expect(isOpen()).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });

  it("closes with Escape", () => {
    render(<MenuModal content={content} />);
    fireEvent.click(menuButton());

    fireEvent.keyDown(document, { key: "Escape" });

    expect(isOpen()).toBe(false);
  });

  it("keeps the home sections folded until asked", () => {
    render(<MenuModal content={content} />);
    fireEvent.click(menuButton());

    expect(
      screen.queryByRole("link", { name: "Novidades" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Mostrar as seções de Início" }),
    );

    expect(screen.getByRole("link", { name: "Novidades" })).toHaveAttribute(
      "href",
      "/#novidades",
    );
  });

  it("marks the current page", () => {
    usePathnameMock.mockReturnValue("/glossary");
    render(<MenuModal content={content} />);

    expect(
      screen.getByRole("link", { name: "Glossário", hidden: true }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("switches the language from the menu, where it lives on phones", () => {
    usePathnameMock.mockReturnValue("/glossary");
    render(<MenuModal content={content} />);
    fireEvent.click(menuButton());

    expect(screen.getByRole("button", { name: "Português" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(replaceMock).toHaveBeenCalledWith("/glossary", { locale: "en" });
    expect(isOpen()).toBe(false);
  });
});
