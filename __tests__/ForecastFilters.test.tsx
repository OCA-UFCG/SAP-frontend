import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ForecastFilters } from "@/components/analysis/ForecastFilters";
import { getForecastMembers, type ForecastMember } from "@/utils/forecastGroup";
import type { PanelLayerI } from "@/utils/interfaces";

function forecastLayer(
  id: string,
  source: string,
  variable: string,
  kind: string,
): PanelLayerI {
  return {
    sys: { id },
    id,
    name: id,
    description: "",
    imageData: {} as PanelLayerI["imageData"],
    forecastFacets: { source, variable, kind },
    statisticsSource: {
      kind: "gee-feature-collection",
      properties: {},
    } as unknown as PanelLayerI["statisticsSource"],
  };
}

const members = getForecastMembers([
  forecastLayer("inmet-t", "INMET", "Temperatura", "Anomalia"),
  forecastLayer("inmet-p", "INMET", "Precipitação", "Anomalia"),
  forecastLayer("inmet-p-prob", "INMET", "Precipitação", "Probabilidade"),
  forecastLayer("cptec-t", "CPTEC", "Temperatura", "Anomalia"),
]);

function Filters() {
  const [current, setCurrent] = useState<ForecastMember>(members[0]);
  return (
    <ForecastFilters members={members} current={current} onSelect={setCurrent} />
  );
}

const group = (name: RegExp) => screen.getByRole("radiogroup", { name });

describe("ForecastFilters", () => {
  afterEach(cleanup);

  it("o Tab para só na opção escolhida de cada grupo", async () => {
    render(<Filters />);
    await userEvent.tab();
    expect(
      within(group(/source/)).getByRole("radio", { checked: true }),
    ).toHaveFocus();
    await userEvent.tab();
    expect(
      within(group(/variable/)).getByRole("radio", { checked: true }),
    ).toHaveFocus();
  });

  it("as setas andam pelo grupo e já escolhem a opção", async () => {
    render(<Filters />);
    within(group(/source/)).getByRole("radio", { checked: true }).focus();

    await userEvent.keyboard("{ArrowRight}");

    const cptec = within(group(/source/)).getByRole("radio", { name: "CPTEC" });
    expect(cptec).toHaveFocus();
    expect(cptec).toBeChecked();
  });

  it("as setas pulam a opção sem camada para o que está escolhido", async () => {
    render(<Filters />);
    const kinds = within(group(/kind/)).getAllByRole("radio");
    // Com Temperatura escolhida, "Probabilidade" fica apagada.
    expect(kinds.find((kind) => kind.textContent === "Probabilidade")).toBeDisabled();
    within(group(/kind/)).getByRole("radio", { checked: true }).focus();

    await userEvent.keyboard("{ArrowRight}");

    expect(
      within(group(/kind/)).getByRole("radio", { checked: true }),
    ).toHaveFocus();
  });
});
