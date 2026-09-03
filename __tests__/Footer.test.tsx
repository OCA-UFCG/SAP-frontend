import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { FooterI } from "@/utils/interfaces";
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

const footerContent: FooterI[] = [
  { id: "home", name: "Home", path: "/", appears: true },
  { id: "platform", name: "Plataforma", path: "/platform", appears: true },
  {
    id: "about",
    name: "Sobre o SEDES",
    path: "/sobre-o-sedes",
    appears: true,
  },
  { id: "contact", name: "Contato", path: "/contact", appears: true },
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
