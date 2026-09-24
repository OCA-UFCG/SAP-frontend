import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { MapAssetStrategyFields } from "@/components/IndexCatalog/MapAssetStrategyFields";
import type { EarthEngineAssetMapping } from "@/types/indexCatalog";

const IDT_2021 =
  "projects/obscaatinga/assets/ColecaoImagens/Index_Degradacao_v4_2021";
const IDT_TEMPLATE =
  "projects/obscaatinga/assets/ColecaoImagens/Index_Degradacao_v4_{year}";

/** Guarda o rascunho como a tela, para a troca de opção chegar ao campo. */
function StatefulFields({
  onChange,
}: {
  onChange: (values: Partial<EarthEngineAssetMapping>) => void;
}) {
  const [mapping, setMapping] = useState<EarthEngineAssetMapping>({
    strategy: "single",
    sourceType: "image",
  });
  return (
    <MapAssetStrategyFields
      mapping={mapping}
      inputClass=""
      onChange={(values) => {
        onChange(values);
        setMapping((current) => ({ ...current, ...values }));
      }}
    />
  );
}

function renderFields(mapping: EarthEngineAssetMapping, latestYear?: string) {
  const onChange = vi.fn();
  render(
    <MapAssetStrategyFields
      mapping={mapping}
      latestYear={latestYear}
      inputClass=""
      onChange={onChange}
    />,
  );
  return onChange;
}

describe("MapAssetStrategyFields", () => {
  afterEach(cleanup);

  it("turns the pasted IDT year into the {year} template (map stuck on 2021)", () => {
    const onChange = vi.fn();
    render(<StatefulFields onChange={onChange} />);

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "year-siblings" },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      strategy: "perPeriod",
      assetPattern: "",
    });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: IDT_2021 },
    });
    expect(onChange).toHaveBeenLastCalledWith({ assetPattern: IDT_TEMPLATE });
    expect(screen.getByText(/Ano 2021 detectado/u)).toBeTruthy();
  });

  it("reopens a saved {year} template showing the concrete latest year", () => {
    renderFields(
      {
        strategy: "perPeriod",
        sourceType: "image",
        assetPattern: IDT_TEMPLATE,
      },
      "2021",
    );

    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(
      "year-siblings",
    );
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
      IDT_2021,
    );
  });

  it("keeps templates with {month} in the explicit template option", () => {
    renderFields({
      strategy: "perPeriod",
      sourceType: "image",
      assetPattern: "projects/x/assets/mapa_{year}_{month}",
    });

    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(
      "perPeriod",
    );
  });
});
