import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ISection } from "@/utils/interfaces";
import { Footer } from "@/components/Footer/Footer";
import { FooterSlot } from "@/components/Footer/FooterSlot";

const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

vi.mock("@/components/ContactSection/SocialChannels", () => ({
  default: () => <div data-testid="social-channels" />,
}));

const footerContent: ISection[] = [
  { id: "1", name: "Início", path: "/", appears: true },
  { id: "3", name: "Sobre", path: "/sobre-o-sedes", appears: true },
  { id: "5", name: "Glossário", path: "/glossary", appears: true },
  { id: "2", name: "Plataforma", path: "/platform", appears: true },
];

describe("Footer", () => {
  beforeEach(() => {
    cleanup();
    usePathnameMock.mockReset();
    usePathnameMock.mockReturnValue("/");
  });

  it("uses the reduced large-screen spacing from the Figma footer", () => {
    const { container } = render(<Footer content={footerContent} />);

    const outer = container.querySelector("footer");
    const inner = outer?.firstElementChild;
    const logo = screen.getByAltText("SEDES");

    expect(outer).toBeInTheDocument();
    expect(inner?.className).toContain("lg:px-20");
    expect(inner?.className).toContain("lg:py-12");
    expect(inner?.className).toContain("lg:gap-[60px]");
    expect(logo.className).toContain("h-[57px]");
  });

  // Regressão: os logos parceiros e as redes sociais estavam empilhados numa
  // coluna, somando 96px de conteúdo. O rodapé passava dos 153px do Figma e, na
  // plataforma, essa faixa a mais era arrancada da tela do mapa.
  it("keeps the partner logos and the social links on a single band", () => {
    render(<Footer content={footerContent} />);

    const logosRow = screen.getByAltText(
      "Ministério do Meio Ambiente e Mudança do Clima",
    ).parentElement;

    expect(logosRow?.className).not.toContain("flex-col");
    expect(logosRow).toContainElement(
      screen.getByAltText("Observatório da Caatinga e Desertificação"),
    );
    expect(logosRow).toContainElement(screen.getByTestId("social-channels"));
  });

  it("shows the same links as the top menu, plus the institutional line", () => {
    render(<Footer content={footerContent} />);

    expect(
      screen
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Início", "/"],
      ["Sobre", "/sobre-o-sedes"],
      ["Glossário", "/glossary"],
      ["Plataforma", "/platform"],
      ["Acessibilidade", "/acessibilidade"],
    ]);
    expect(
      screen.getByText(
        "Ministério do Meio Ambiente e Mudança do Clima | Universidade Federal de Campina Grande | Observatório da Caatinga e Desertificação",
      ),
    ).toBeInTheDocument();
  });

  // LBI, art. 63, §1º: o símbolo de acessibilidade fica em destaque. Ele não
  // entra na linha de links, que some no celular.
  it("shows the accessibility symbol linking to the accessibility page", () => {
    render(<Footer content={footerContent} />);

    const link = screen.getByRole("link", { name: "Acessibilidade" });

    expect(link).toHaveAttribute("href", "/acessibilidade");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(link.closest(".hidden")).toBeNull();
  });

  it("is the target of the skip-to-footer shortcut", () => {
    const { container } = render(<Footer content={footerContent} />);

    const footer = container.querySelector("footer");

    expect(footer).toHaveAttribute("id", "rodape");
    expect(footer).toHaveAttribute("tabindex", "-1");
  });

  // O rodapé faz parte da plataforma. O caminho vem com o prefixo de locale
  // (`localePrefix: "always"`), então qualquer regra por rota precisa ser
  // exercitada com o caminho real, e não com um "/platform" que nunca ocorre.
  it("renders on the platform route", () => {
    usePathnameMock.mockReturnValue("/pt/platform");

    render(<FooterSlot content={footerContent} />);

    expect(screen.getByAltText("SEDES")).toBeInTheDocument();
  });

  it("renders on the multicriteria route", () => {
    usePathnameMock.mockReturnValue("/pt/platform/amfe");

    render(<FooterSlot content={footerContent} />);

    expect(screen.getByAltText("SEDES")).toBeInTheDocument();
  });

  it("renders on non-platform routes", () => {
    render(<FooterSlot content={footerContent} />);

    expect(screen.getByAltText("SEDES")).toBeInTheDocument();
    expect(screen.getByTestId("social-channels")).toBeInTheDocument();
  });
});
