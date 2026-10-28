import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GlossarySection } from "@/components/GlossarySection/GlossarySection";

const terms = [
  {
    id: "aridez",
    term: "Aridez",
    definition: "Característica permanente do clima de uma região.",
    tags: ["Território", "Monitoramento"],
  },
  {
    id: "caatinga",
    term: "Bioma Caatinga",
    definition: "Bioma exclusivamente brasileiro.",
    tags: [],
  },
  {
    id: "ia",
    term: "Índice de Aridez (IA)",
    definition: "Razão entre a precipitação e a evapotranspiração.",
    tags: [],
  },
];

const shownTerms = () =>
  screen.queryAllByRole("heading", { level: 2 }).map((item) => item.textContent);

describe("GlossarySection", () => {
  afterEach(cleanup);

  it("mostra um botão por letra inicial, com a letra sem acento", () => {
    render(<GlossarySection terms={terms} />);

    const buttons = screen
      .getByRole("group", { name: "Filtrar por letra inicial" })
      .querySelectorAll("button");
    expect([...buttons].map((button) => button.textContent)).toEqual([
      "Todos",
      "A",
      "B",
      "I",
    ]);
  });

  it("filtra pela letra e volta a mostrar todos", () => {
    render(<GlossarySection terms={terms} />);

    fireEvent.click(screen.getByRole("button", { name: "I" }));
    expect(shownTerms()).toEqual(["Índice de Aridez (IA)"]);
    expect(screen.getByRole("button", { name: "I" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Todos" }));
    expect(shownTerms()).toHaveLength(3);
  });

  it("busca no termo e na definição ignorando acento e caixa", () => {
    render(<GlossarySection terms={terms} />);
    const search = screen.getByRole("searchbox", {
      name: "Busque o termo aqui",
    });

    fireEvent.change(search, { target: { value: "indice" } });
    expect(shownTerms()).toEqual(["Índice de Aridez (IA)"]);

    fireEvent.change(search, { target: { value: "BRASILEIRO" } });
    expect(shownTerms()).toEqual(["Bioma Caatinga"]);

    fireEvent.change(search, { target: { value: "xyz" } });
    expect(shownTerms()).toEqual([]);
    expect(screen.getByText("Nenhum termo encontrado.")).toBeInTheDocument();
  });

  it("mostra as etiquetas do Contentful só nos termos que têm", () => {
    render(<GlossarySection terms={terms} />);

    expect(screen.getByText("Território")).toBeInTheDocument();
    expect(screen.getByText("Monitoramento")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });
});
