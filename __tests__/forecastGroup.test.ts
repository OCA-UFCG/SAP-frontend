import { describe, expect, it } from "vitest";
import {
  parseForecastFacetsInput,
  tryParsePanelLayerForecastFacets,
} from "@/contracts/panelLayerForecast";
import { DEFAULT_FORECAST_SELECTION } from "@/config/forecastGroup";
import {
  getForecastFilterOptions,
  getForecastMembers,
  resolveForecastSelection,
  type ForecastMember,
} from "@/utils/forecastGroup";
import type { PanelLayerI } from "@/utils/interfaces";

function forecastLayer(
  id: string,
  source: string,
  variable: string,
  kind: string,
  quarterly = false,
): PanelLayerI {
  return {
    sys: { id },
    id,
    name: id,
    description: "",
    imageData: {} as PanelLayerI["imageData"],
    forecastFacets: { source, variable, kind },
    statisticsSource: (quarterly
      ? { kind: "gee-feature-collection", properties: { season: "temporada" } }
      : {
          kind: "gee-feature-collection",
          properties: {},
        }) as unknown as PanelLayerI["statisticsSource"],
  };
}

// As 10 previsões publicadas em outubro de 2026.
const LAYERS: PanelLayerI[] = [
  forecastLayer("inmet-t-mensal", "INMET", "Temperatura", "Anomalia"),
  forecastLayer("inmet-t-tri", "INMET", "Temperatura", "Anomalia", true),
  forecastLayer("inmet-p-mensal", "INMET", "Precipitação", "Anomalia"),
  forecastLayer("inmet-p-tri", "INMET", "Precipitação", "Anomalia", true),
  forecastLayer("inmet-p-acumulado", "INMET", "Precipitação", "Acumulado"),
  forecastLayer("inmet-p-prob", "INMET", "Precipitação", "Probabilidade"),
  forecastLayer("cptec-t-mensal", "CPTEC", "Temperatura", "Anomalia"),
  forecastLayer("cptec-t-tri", "CPTEC", "Temperatura", "Anomalia", true),
  forecastLayer("cptec-p-mensal", "CPTEC", "Precipitação", "Anomalia"),
  forecastLayer("cptec-p-tri", "CPTEC", "Precipitação", "Anomalia", true),
];

const members = getForecastMembers(LAYERS);

function member(id: string): ForecastMember {
  const found = members.find((candidate) => candidate.layer.id === id);
  if (!found) throw new Error(`sem ${id}`);
  return found;
}

describe("getForecastMembers", () => {
  it("lê a periodicidade da coluna de temporada e ignora quem não declarou filtros", () => {
    const loose = { ...LAYERS[0], id: "monitor", forecastFacets: null };

    const result = getForecastMembers([loose, LAYERS[0], LAYERS[1]]);

    expect(
      result.map(({ layer, periodicity }) => [layer.id, periodicity]),
    ).toEqual([
      ["inmet-t-mensal", "monthly"],
      ["inmet-t-tri", "quarterly"],
    ]);
  });
});

describe("resolveForecastSelection", () => {
  it("a escolha padrão liga INMET · Precipitação · Mensal · Anomalia", () => {
    expect(
      resolveForecastSelection(members, DEFAULT_FORECAST_SELECTION)?.layer.id,
    ).toBe("inmet-p-mensal");
  });

  it("trocar a periodicidade mantém fonte, variável e tipo", () => {
    const next = resolveForecastSelection(members, {
      ...member("inmet-t-mensal"),
      periodicity: "quarterly",
    });

    expect(next?.layer.id).toBe("inmet-t-tri");
  });

  it("quando o tipo some na fonte nova, cai na primeira opção que existe", () => {
    const next = resolveForecastSelection(members, {
      ...member("inmet-p-acumulado"),
      source: "CPTEC",
    });

    expect(next?.layer.id).toBe("cptec-p-mensal");
  });

  it("compara sem acento e sem caixa", () => {
    const next = resolveForecastSelection(members, {
      source: "inmet",
      variable: "precipitacao",
      periodicity: "monthly",
      kind: "probabilidade",
    });

    expect(next?.layer.id).toBe("inmet-p-prob");
  });

  it("sem previsões, não escolhe nada", () => {
    expect(
      resolveForecastSelection([], DEFAULT_FORECAST_SELECTION),
    ).toBeNull();
  });
});

describe("getForecastFilterOptions", () => {
  it("apaga os tipos que não existem para o que está escolhido acima", () => {
    const options = getForecastFilterOptions(
      members,
      member("inmet-t-mensal"),
    );

    expect(options.source.map(({ value, enabled }) => [value, enabled])).toEqual(
      [
        ["CPTEC", true],
        ["INMET", true],
      ],
    );
    expect(options.kind).toEqual([
      { value: "Acumulado", enabled: false, selected: false },
      { value: "Anomalia", enabled: true, selected: true },
      { value: "Probabilidade", enabled: false, selected: false },
    ]);
  });

  it("libera Acumulado e Probabilidade só em INMET · Precipitação · Mensal", () => {
    const enabledKinds = (id: string) =>
      getForecastFilterOptions(members, member(id))
        .kind.filter((option) => option.enabled)
        .map((option) => option.value);

    expect(enabledKinds("inmet-p-mensal")).toEqual([
      "Acumulado",
      "Anomalia",
      "Probabilidade",
    ]);
    expect(enabledKinds("inmet-p-tri")).toEqual(["Anomalia"]);
    expect(enabledKinds("cptec-p-mensal")).toEqual(["Anomalia"]);
  });

  it("mostra mensal antes de trimestral", () => {
    const options = getForecastFilterOptions(members, member("cptec-t-tri"));

    expect(options.periodicity).toEqual([
      { value: "monthly", enabled: true, selected: false },
      { value: "quarterly", enabled: true, selected: true },
    ]);
  });
});

describe("parseForecastFacetsInput", () => {
  it("três campos vazios significam que o índice não entra nos filtros", () => {
    expect(
      parseForecastFacetsInput({ source: " ", variable: "", kind: "" }),
    ).toBeUndefined();
    expect(parseForecastFacetsInput(undefined)).toBeUndefined();
  });

  it("recusa preenchimento parcial dizendo o que falta", () => {
    expect(() =>
      parseForecastFacetsInput({ source: "INMET", variable: "", kind: "" }),
    ).toThrow("Preencha também Variável e Tipo da previsão climática.");
  });

  it("apara os espaços", () => {
    expect(
      parseForecastFacetsInput({
        source: " INMET ",
        variable: "Precipitação",
        kind: "Anomalia ",
      }),
    ).toEqual({ source: "INMET", variable: "Precipitação", kind: "Anomalia" });
  });

  it("na leitura do publicado, um valor inválido vira null em vez de erro", () => {
    expect(tryParsePanelLayerForecastFacets({ source: "INMET" })).toBeNull();
    expect(tryParsePanelLayerForecastFacets("INMET")).toBeNull();
  });
});
