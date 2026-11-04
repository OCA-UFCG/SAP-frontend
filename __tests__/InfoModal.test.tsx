import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InfoModal } from "@/components/InfoModal/InfoModal";

const card = { id: 1, title: "Monitor de Secas", description: "Seca." };

afterEach(cleanup);

describe("InfoModal", () => {
  it("opens the index's original source in a new tab", () => {
    render(
      <InfoModal
        card={{ ...card, learnMoreUrl: "https://monitordesecas.ana.gov.br/" }}
        open
        onClose={vi.fn()}
      />,
    );
    const link = screen.getByRole("link", {
      name: "Ver fonte original (abre em nova aba)",
    });

    expect(link).toHaveAttribute("href", "https://monitordesecas.ana.gov.br/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("has no external link without somewhere to go", () => {
    render(<InfoModal card={card} open onClose={vi.fn()} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  // O campo também pode ser editado direto no Contentful, sem passar pelo
  // catálogo.
  it("ignores a link that is not http(s)", () => {
    render(
      <InfoModal
        card={{ ...card, learnMoreUrl: "javascript:alert(1)" }}
        open
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
