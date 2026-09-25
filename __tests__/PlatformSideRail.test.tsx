import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { linkStatusMock } = vi.hoisted(() => ({
  linkStatusMock: vi.fn(() => ({ pending: false })),
}));

vi.mock("next/link", () => ({
  useLinkStatus: () => linkStatusMock(),
  default: ({
    children,
    href,
    className,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
    [key: string]: unknown;
  }) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

import { PlatformSideRail } from "@/components/PlatformSideRail/PlatformSideRail";

afterEach(() => {
  cleanup();
  linkStatusMock.mockReturnValue({ pending: false });
});

describe("PlatformSideRail", () => {
  // A trilha continua alta como a viewport nas telas que rolam (catálogo,
  // auditoria), mas não pode ultrapassar o container nas que cabem inteiras —
  // senão ela invade o rodapé que fica logo abaixo da plataforma.
  it("never grows past the shell that holds it", () => {
    render(
      <PlatformSideRail
        activeSection="monitoring"
        onSectionChange={vi.fn()}
        isPanelOpen
        onTogglePanel={vi.fn()}
        showAuditLink={false}
      />,
    );

    expect(document.querySelector("[data-platform-side-rail]")).toHaveClass(
      "max-h-full",
    );
  });

  it("renders the audit link only when the server enables logs access", () => {
    const { rerender } = render(
      <PlatformSideRail
        activeSection="monitoring"
        onSectionChange={vi.fn()}
        isPanelOpen
        onTogglePanel={vi.fn()}
        showAuditLink={false}
      />,
    );

    expect(
      screen.queryByRole("link", { name: "Auditoria" }),
    ).not.toBeInTheDocument();

    rerender(
      <PlatformSideRail
        activeSection="monitoring"
        onSectionChange={vi.fn()}
        isPanelOpen
        onTogglePanel={vi.fn()}
        showAuditLink
      />,
    );

    expect(screen.getByRole("link", { name: "Auditoria" })).toHaveAttribute(
      "href",
      "/platform?view=logs",
    );
    expect(
      screen.getByRole("link", { name: "Catálogo de índices" }),
    ).toHaveAttribute("href", "/platform?view=catalog");
  });

  it("marks only the catalog entry as active in the catalog view", () => {
    render(
      <PlatformSideRail
        activeSection="catalog"
        onSectionChange={vi.fn()}
        isPanelOpen={false}
        onTogglePanel={vi.fn()}
        showAuditLink
      />,
    );

    expect(
      screen.getByRole("link", { name: "Catálogo de índices" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Auditoria" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks the audit entry as active when the logs view is open", () => {
    render(
      <PlatformSideRail
        activeSection="logs"
        onSectionChange={vi.fn()}
        isPanelOpen={false}
        onTogglePanel={vi.fn()}
        showAuditLink
      />,
    );

    expect(screen.getByRole("link", { name: "Auditoria" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("pins the rail to the viewport instead of stretching with long pages", () => {
    render(
      <PlatformSideRail
        activeSection="logs"
        onSectionChange={vi.fn()}
        isPanelOpen={false}
        onTogglePanel={vi.fn()}
        showAuditLink
      />,
    );

    const rail = screen.getByRole("navigation").parentElement;

    expect(rail).toHaveClass("sticky");
    // `top-16.5` e `100vh-66px` são a altura real do cabeçalho (`h-16.5` mais a
    // borda). Os antigos 64px deixavam a trilha 2px fora de lugar.
    expect(rail).toHaveClass("top-16.5");
    expect(rail).toHaveClass("h-[calc(100vh-66px)]");
    expect(rail).toHaveClass("w-[140px]");
  });

  // Auditoria, catálogo e aprovações continuam sendo páginas separadas, e ir
  // até elas espera o servidor. Sem esse aviso a trilha fica parada depois do
  // clique e a pessoa não sabe se acertou o botão.
  it("marks a rail link as loading while its navigation is in flight", () => {
    linkStatusMock.mockReturnValue({ pending: true });

    render(
      <PlatformSideRail
        activeSection="monitoring"
        onSectionChange={() => {}}
        isPanelOpen
        onTogglePanel={() => {}}
        showAuditLink
      />,
    );

    expect(screen.getAllByRole("status", { name: "Carregando" })).toHaveLength(
      3,
    );
  });

  it("marks the section the rail is navigating to", () => {
    render(
      <PlatformSideRail
        activeSection="logs"
        onSectionChange={() => {}}
        isPanelOpen={false}
        onTogglePanel={() => {}}
        showAuditLink
        pendingSection="monitoring"
      />,
    );

    expect(
      screen.getByRole("button", { name: /Monitoramento/i }),
    ).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("button", { name: /Análise/i }),
    ).not.toHaveAttribute("aria-busy");
  });
});
