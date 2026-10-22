import { afterEach, describe, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  ChartDataTable,
  ChartDescription,
} from "@/components/ChartDataTable/ChartDataTable";

const series = [
  { id: "sem", label: "Sem seca" },
  { id: "fraca", label: "Seca fraca" },
];
const rows = [
  { period: "2023", label: "2023", values: { sem: 10, fraca: 90 } },
  { period: "2024", label: "2024", values: { sem: 55, fraca: null } },
];

afterEach(cleanup);

function renderTable() {
  return render(
    <ChartDataTable
      caption="Monitor de Secas"
      series={series}
      rows={rows}
      formatValue={(value) => `${value}%`}
    />,
  );
}

describe("ChartDataTable", () => {
  it("nasce recolhida, com o botão dizendo que está fechada", () => {
    renderTable();
    const toggle = screen.getByRole("button", { name: "Ver dados em tabela" });

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("abre uma tabela com legenda, cabeçalhos de coluna e de linha", () => {
    renderTable();
    fireEvent.click(
      screen.getByRole("button", { name: "Ver dados em tabela" }),
    );

    const table = screen.getByRole("table", { name: "Monitor de Secas" });
    const columns = within(table).getAllByRole("columnheader");
    const rowHeaders = within(table).getAllByRole("rowheader");

    expect(columns.map((cell) => cell.textContent)).toEqual([
      "Período",
      "Sem seca",
      "Seca fraca",
    ]);
    expect(columns.every((cell) => cell.getAttribute("scope") === "col")).toBe(
      true,
    );
    expect(rowHeaders.map((cell) => cell.textContent)).toEqual([
      "2023",
      "2024",
    ]);
    expect(
      screen.getByRole("button", { name: "Esconder tabela de dados" }),
    ).toBeTruthy();
  });

  it("formata os valores e marca a célula sem medida", () => {
    renderTable();
    fireEvent.click(
      screen.getByRole("button", { name: "Ver dados em tabela" }),
    );

    expect(screen.getByText("90%")).toBeTruthy();
    expect(screen.getByText("Sem dado")).toBeTruthy();
  });

  it("não desenha nada sem dados", () => {
    const { container } = render(
      <ChartDataTable
        caption="Vazio"
        series={series}
        rows={[]}
        formatValue={String}
      />,
    );

    expect(container.innerHTML).toBe("");
  });
});

describe("ChartDescription", () => {
  it("deixa a descrição no DOM com o id que o gráfico referencia", () => {
    const { container } = render(<ChartDescription id="desc" text="Resumo" />);

    expect(container.querySelector("#desc")?.textContent).toBe("Resumo");
  });

  it("não deixa um parágrafo vazio quando não há resumo", () => {
    const { container } = render(<ChartDescription id="desc" text="" />);

    expect(container.querySelector("#desc")).toBeNull();
  });
});
