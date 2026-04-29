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
});

const model: TerritorialAnalysisViewModel = {
  kind: "territorial",
  name: "Brasil",
  accentColor: "#B4BA61",
  highlight: null,
  happening: "",
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
  ],
};

describe("AnalysisPanel", () => {
  it("keeps the back action pinned at the top of the scrollable panel", () => {
    render(
      <AnalysisPanel
        moduleName="Teste"
        yearOptions={[{ value: "2024", label: "2024" }]}
        activeYear="2024"
        onBack={vi.fn()}
        onSearch={vi.fn()}
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
});
