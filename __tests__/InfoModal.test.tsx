import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InfoModal } from "@/components/InfoModal/InfoModal";

const card = { id: 1, title: "Monitor de Secas", description: "Seca." };

afterEach(cleanup);

describe("InfoModal", () => {
  it("closes and opens the details from 'Saiba mais'", () => {
    const onClose = vi.fn();
    const onLearnMore = vi.fn();

    render(
      <InfoModal card={card} open onClose={onClose} onLearnMore={onLearnMore} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Saiba mais" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onLearnMore).toHaveBeenCalledOnce();
  });

  it("has no 'Saiba mais' without somewhere to go", () => {
    render(<InfoModal card={card} open onClose={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: "Saiba mais" }),
    ).not.toBeInTheDocument();
  });
});
