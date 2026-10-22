import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnalysisPanel } from "@/components/analysis/AnalysisPanel";
import type { TerritorialAnalysisViewModel } from "@/utils/analysis";

vi.mock("@/components/SidePanelContexts/SearchBarPlatform", () => ({
  default: () => <div data-testid="search-bar-platform" />,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const model: TerritorialAnalysisViewModel = {
  kind: "territorial",
  name: "Brasil",
  accentColor: "#B4BA61",
  highlight: null,
  distribution: [],
  rankingTitle: "Estados por classificação",
  rankingGroups: [
    {
      id: "classe-a",
      label: "Classe A",
      tone: {
        color: "#B4BA61",
        bg: "rgba(180, 186, 97, 0.16)",
        border: "rgba(180, 186, 97, 0.4)",
      },
      total: 2,
      totalLabel: "Estados",
      items: [
        { id: "ac", label: "Acre", trailingLabel: "55.0%" },
        { id: "se", label: "Sergipe", trailingLabel: "1.0%" },
      ],
    },
    {
      id: "classe-b",
      label: "Classe B",
      tone: {
        color: "#5B612A",
        bg: "rgba(91, 97, 42, 0.16)",
        border: "rgba(91, 97, 42, 0.4)",
      },
      total: 4,
      totalLabel: "Estados",
      items: [{ id: "mg", label: "Minas Gerais", trailingLabel: "60.0%" }],
    },
    {
      id: "classe-c",
      label: "Classe C",
      tone: {
        color: "#3A3D1F",
        bg: "rgba(58, 61, 31, 0.16)",
        border: "rgba(58, 61, 31, 0.4)",
      },
      total: 0,
      totalLabel: "Estados",
      items: [],
    },
  ],
};

function renderPanel(panelModel = model) {
  return render(
    <AnalysisPanel
      moduleName="Teste"
      yearOptions={[{ value: "2024", label: "2024" }]}
      activeYear="2024"
      onBack={vi.fn()}
      onSearch={vi.fn()}
      searchTelemetryContext={{
        activeLayerId: "test",
        activeLayerName: "Test",
        activeDateLabel: "2024",
      }}
      onYearChange={vi.fn()}
      model={panelModel}
    />,
  );
}

describe("AnalysisPanel", () => {
  it("opens the date list scrolled to the selected date", async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.getAttribute("aria-selected") === "true" ? 400 : 0;
      },
    );
    render(
      <AnalysisPanel
        moduleName="Teste"
        yearOptions={["2001", "2006", "2012", "2018"].map((year) => ({
          value: year,
          label: year,
        }))}
        activeYear="2012"
        onBack={vi.fn()}
        onSearch={vi.fn()}
        searchTelemetryContext={{
          activeLayerId: "test",
          activeLayerName: "Test",
          activeDateLabel: "2012",
        }}
        onYearChange={vi.fn()}
        model={model}
      />,
    );

    // O botão se anuncia com o rótulo e o ano escolhido.
    await user.click(
      screen.getByRole("button", { name: "Data da análise 2012" }),
    );

    expect(screen.getByRole("option", { name: "2012" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("listbox").scrollTop).toBe(400);
  });

  it("shows an accessible spinner beside the on-demand loading message", () => {
    render(
      <AnalysisPanel
        moduleName="Teste"
        yearOptions={[{ value: "2024", label: "2024" }]}
        activeYear="2024"
        onBack={vi.fn()}
        onSearch={vi.fn()}
        searchTelemetryContext={{
          activeLayerId: "test",
          activeLayerName: "Test",
          activeDateLabel: "2024",
        }}
        onYearChange={vi.fn()}
        model={null}
        emptyStateTitle="Carregando dados"
        emptyStateDescription="Os dados municipais desta camada estão sendo carregados sob demanda."
        emptyStateLoading
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent(
      "Os dados municipais desta camada estão sendo carregados sob demanda.",
    );
    expect(status.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows when the forecast was issued, above the analysis date", () => {
    const { rerender } = renderPanel();
    expect(screen.queryByText(/emitida em/i)).not.toBeInTheDocument();

    rerender(
      <AnalysisPanel
        moduleName="Previsão climática"
        yearOptions={[{ value: "2026-11", label: "2026-11" }]}
        activeYear="2026-11"
        onBack={vi.fn()}
        onSearch={vi.fn()}
        searchTelemetryContext={{
          activeLayerId: "test",
          activeLayerName: "Test",
          activeDateLabel: "2026-11",
        }}
        onYearChange={vi.fn()}
        model={model}
        forecastEmissionDate="2026-10-01"
      />,
    );

    const emission = screen.getByText("Previsão emitida em outubro de 2026");
    expect(
      emission.compareDocumentPosition(screen.getByText("Data da análise")),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("keeps the back action pinned at the top of the scrollable panel", () => {
    render(
      <AnalysisPanel
        moduleName="Teste"
        yearOptions={[{ value: "2024", label: "2024" }]}
        activeYear="2024"
        onBack={vi.fn()}
        onSearch={vi.fn()}
        searchTelemetryContext={{
          activeLayerId: "test",
          activeLayerName: "Test",
          activeDateLabel: "2024",
        }}
        onYearChange={vi.fn()}
        onRankingItemSelect={vi.fn()}
        model={model}
      />,
    );

    expect(screen.getByTestId("analysis-panel-back-header")).toHaveClass(
      "sticky",
      "top-0",
      "z-10",
    );
    expect(
      screen.getByRole("button", { name: "Voltar para listagem" }),
    ).toBeVisible();
  });

  it("shows top items initially, can open to show all, then close and reopen showing all", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onSearch = vi.fn();
    const onYearChange = vi.fn();
    const onRankingItemSelect = vi.fn();

    render(
      <AnalysisPanel
        moduleName="Teste"
        yearOptions={[{ value: "2024", label: "2024" }]}
        activeYear="2024"
        onBack={onBack}
        onSearch={onSearch}
        searchTelemetryContext={{
          activeLayerId: "test",
          activeLayerName: "Test",
          activeDateLabel: "2024",
        }}
        onYearChange={onYearChange}
        onRankingItemSelect={onRankingItemSelect}
        model={model}
      />,
    );

    // top entries are visible initially
    expect(screen.getByRole("button", { name: "Acre: 55.0%" })).toBeVisible();
    expect(screen.getByText("55.0%")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Minas Gerais: 60.0%" }),
    ).toBeVisible();

    // initial toggle is a "Mostrar" action (accessible name)
    await user.click(screen.getByRole("button", { name: "Mostrar Classe A" }));

    // after opening, the toggle becomes a close action
    expect(
      screen.getByRole("button", { name: "Ocultar Classe A" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Acre: 55.0%" })).toBeVisible();

    // click close to hide entries
    await user.click(screen.getByRole("button", { name: "Ocultar Classe A" }));

    expect(
      screen.queryByRole("button", { name: "Acre: 55.0%" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mostrar Classe A" }),
    ).toBeVisible();
  });

  it("shows the dominant class and its share in a single overview box", () => {
    renderPanel({
      ...model,
      highlight: {
        label: "Úmido",
        text: "Região majoritariamente classificada como: Úmido",
        value: 86.7,
        tone: {
          color: "#3A3D1F",
          bg: "rgba(58, 61, 31, 0.16)",
          border: "rgba(58, 61, 31, 0.4)",
        },
      },
    });

    expect(
      screen.getByRole("heading", { name: "Panorama geral" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Região majoritariamente classificada como: Úmido (86,70% da área analisada)",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Informações gerais")).not.toBeInTheDocument();
    expect(
      screen.queryByText("O que está acontecendo?"),
    ).not.toBeInTheDocument();
  });

  it("shows absolute values with their unit in the overview box", () => {
    renderPanel({
      ...model,
      valueType: "absolute",
      valueUnit: "registros",
      highlight: {
        label: "Registros de secas e estiagens",
        text: "Registros de secas e estiagens",
        value: 247,
        tone: {
          color: "#8c2d04",
          bg: "rgba(140, 45, 4, 0.16)",
          border: "rgba(140, 45, 4, 0.4)",
        },
      },
    });

    expect(
      screen.getByText("Registros de secas e estiagens (247 registros)"),
    ).toBeInTheDocument();
  });

  it("hides classes without any state", () => {
    renderPanel();

    expect(screen.getByText("Classe A")).toBeVisible();
    expect(screen.queryByText("Classe C")).not.toBeInTheDocument();
    expect(screen.queryByText("Sem estados com valor")).not.toBeInTheDocument();
  });

  it("shows the empty message when no class has states", () => {
    renderPanel({
      ...model,
      rankingGroups: model.rankingGroups.map((group) => ({
        ...group,
        items: [],
      })),
    });

    expect(
      screen.getByText(
        "Os agrupamentos por classificação ainda não estão disponíveis para esta camada.",
      ),
    ).toBeVisible();
  });
});
