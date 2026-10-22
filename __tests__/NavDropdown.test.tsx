import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NavDropdown } from "@/components/NavDropdown/NavDropdown";
import type { ISection } from "@/utils/interfaces";

vi.mock("@/translations/routing", () => ({
  Link: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

const item = {
  id: "inicio",
  name: "Início",
  path: "#",
  childrenCollection: {
    items: [
      { id: "sobre", name: "Sobre", path: "/sobre" },
      { id: "glossario", name: "Glossário", path: "/glossario" },
    ],
  },
} as unknown as ISection;

describe("NavDropdown", () => {
  afterEach(cleanup);

  it("diz se o menu está aberto", async () => {
    render(<NavDropdown item={item} />);
    const trigger = screen.getByRole("button", { name: "Início" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await userEvent.tab();
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.mouseLeave(trigger.parentElement!);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("Esc fecha o menu e devolve o foco ao botão", async () => {
    render(<NavDropdown item={item} />);
    const trigger = screen.getByRole("button", { name: "Início" });
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole("link", { name: "Sobre" })).toHaveFocus();

    await userEvent.keyboard("{Escape}");

    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    // `hidden` é do Tailwind: no navegador tira os links da tela e do Tab.
    expect(
      screen.getByRole("link", { name: "Sobre" }).closest(".hidden"),
    ).not.toBeNull();
  });
});
