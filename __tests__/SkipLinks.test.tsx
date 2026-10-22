import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SkipLinks } from "@/components/SkipLinks/SkipLinks";
import { SKIP_TARGETS } from "@/components/SkipLinks/skipTargets";

vi.mock("@/translations/routing", () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe("SkipLinks", () => {
  // eMAG 3.1: conteúdo [1], menu [2], rodapé [4], nesta ordem, antes de tudo.
  it("offers the eMAG shortcuts in order, each pointing to its target", () => {
    render(<SkipLinks />);

    const links = screen.getAllByRole("link");

    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#conteudo",
      "#menu",
      "#rodape",
      "/acessibilidade",
    ]);
    expect(links.map((link) => link.getAttribute("accesskey"))).toEqual([
      "1",
      "2",
      "4",
      null,
    ]);
  });

  it("names the links in words, not by the key number", () => {
    render(<SkipLinks />);

    expect(
      screen.getByRole("link", { name: "Ir para o conteúdo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Atalhos de acessibilidade" }),
    ).toBeInTheDocument();
  });

  it("keeps the targets' ids in sync with the links", () => {
    expect(Object.values(SKIP_TARGETS).map(({ id }) => id)).toEqual([
      "conteudo",
      "menu",
      "rodape",
    ]);
  });
});
