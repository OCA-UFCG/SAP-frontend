import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { PlatformSideRail } from "@/components/PlatformSideRail/PlatformSideRail";

describe("PlatformSideRail", () => {
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
      "/platform/logs",
    );
  });
});
