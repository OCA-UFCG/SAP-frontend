import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ValueRangeFields } from "@/components/IndexCatalog/MunicipalValueTableFields";
import type { ClassMapping } from "@/types/indexCatalog";
import { parseIndexCatalogDraftInput } from "@/utils/indexCatalog";

afterEach(cleanup);

/** Renderiza as faixas mantendo o estado, como a tela do catálogo faz. */
function renderRanges(initial: ClassMapping[] = []) {
  const state = { ranges: initial };
  const view = render(
    <ValueRangeFields
      ranges={state.ranges}
      thresholdsInput=""
      inputClass=""
      buttonClass=""
      onChangeRange={() => undefined}
      onChangeRanges={(ranges) => {
        state.ranges = ranges;
        view.rerender(fields(state.ranges));
      }}
      onChangeThresholds={() => undefined}
    />,
  );

  function fields(ranges: ClassMapping[]) {
    return (
      <ValueRangeFields
        ranges={ranges}
        thresholdsInput=""
        inputClass=""
        buttonClass=""
        onChangeRange={() => undefined}
        onChangeRanges={(next) => {
          state.ranges = next;
          view.rerender(fields(next));
        }}
        onChangeThresholds={() => undefined}
      />
    );
  }

  return state;
}

function addRange() {
  fireEvent.click(screen.getByRole("button", { name: "Adicionar faixa" }));
}

function draftWith(classes: ClassMapping[]) {
  return {
    name: "Registros de secas",
    description: "Quantidade anual de registros municipais.",
    category: "Dados Socioeconômicos",
    statisticsSource: {
      kind: "gee-municipal-value-table",
      asset: { type: "fixed", assetId: "projects/example/assets/s2id" },
      periodGranularity: "year",
      valueProperty: "{year}",
      aggregation: "sum",
      properties: {
        municipalityCode: "CD_MUN",
        locationName: "NM_MUN",
        stateCode: "SIGLA_UF",
      },
    },
    classes,
    earthEngine: {
      strategy: "single",
      sourceType: "featureCollection",
      singleAssetId: "projects/example/assets/s2id",
      property: "{year}",
      thresholds: [6],
    },
    valueIndicator: {
      label: "Registros",
      color: "#BD0026",
      measurementUnit: "registros",
      valueType: "absolute",
    },
  };
}

describe("ValueRangeFields", () => {
  /**
   * O cálculo das faixas fica dentro deste bloco, acima do campo de limites que
   * ele preenche: era um bloco irmão no fim do formulário, e nada na tela dizia
   * que os limites calculados caíam aqui.
   */
  it("desenha o cálculo das faixas antes do campo de limites", () => {
    render(
      <ValueRangeFields
        ranges={[]}
        thresholdsInput=""
        inputClass=""
        buttonClass=""
        methodSlot={<p>Calcular as faixas pelos dados</p>}
        onChangeRange={() => undefined}
        onChangeRanges={() => undefined}
        onChangeThresholds={() => undefined}
      />,
    );

    const slot = screen.getByText("Calcular as faixas pelos dados");
    const limits = screen.getByText(/Limites entre as faixas/u);
    expect(
      slot.compareDocumentPosition(limits) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("numera as faixas novas sem repetir o ID de uma faixa removida", () => {
    // Regressão: `id` saía de `ranges.length + 1`, e a remoção só renumerava a
    // posição. Apagar a faixa do meio de três e acrescentar outra gerava dois
    // `faixa-3`, e o cadastro recusava com "IDs duplicados" — sem campo na tela
    // para corrigir, porque o ID da faixa não é editável.
    const state = renderRanges();
    addRange();
    addRange();
    addRange();
    fireEvent.click(screen.getAllByRole("button", { name: "Remover" })[1]);
    addRange();

    const ids = state.ranges.map((range) => range.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(state.ranges.map((range) => range.classIndex)).toEqual([0, 1, 2]);
  });

  it("as faixas resultantes passam pela validação do cadastro", () => {
    const state = renderRanges();
    addRange();
    addRange();
    addRange();
    fireEvent.click(screen.getAllByRole("button", { name: "Remover" })[1]);
    addRange();

    const classes = state.ranges.map((range, position) => ({
      ...range,
      label: `Faixa ${position + 1}`,
    }));
    expect(() => parseIndexCatalogDraftInput(draftWith(classes))).not.toThrow();
  });
});
