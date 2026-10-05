import { describe, expect, it } from "vitest";
import type { LayerSubgroupDefinition } from "@/config/layerSubgroups";
import {
  flattenLayerSubgroups,
  splitIntoLayerSubgroups,
} from "@/utils/layerSubgroups";

interface NamedLayer {
  name: string;
}

const byName = (layer: NamedLayer) => layer.name;

describe("splitIntoLayerSubgroups", () => {
  it("move os índices de previsão de Dados Climáticos para o subgrupo, preservando a ordem", () => {
    const layers = [
      { name: "Monitor de Secas" },
      { name: "Previsão: Anomalia Precipitação | CPTEC INPE" },
      { name: "Índice de Aridez" },
      { name: "Previsão: Anomalia Temperatura Trimestral" },
    ];

    const grouped = splitIntoLayerSubgroups("Dados Climáticos", layers, byName);

    expect(grouped.items.map(byName)).toEqual([
      "Monitor de Secas",
      "Índice de Aridez",
    ]);
    expect(grouped.subgroups).toEqual([
      { key: "forecast", items: [layers[1], layers[3]] },
    ]);
  });

  it("compara categoria e prefixo sem acento e sem caixa", () => {
    const grouped = splitIntoLayerSubgroups(
      " dados climaticos ",
      [{ name: "previsao de chuva" }],
      byName,
    );

    expect(grouped.subgroups.map((subgroup) => subgroup.key)).toEqual([
      "forecast",
    ]);
  });

  it("não aplica o subgrupo fora da categoria-mãe", () => {
    const grouped = splitIntoLayerSubgroups(
      "Dados Ambientais",
      [{ name: "Previsão de desmatamento" }],
      byName,
    );

    expect(grouped).toEqual({
      items: [{ name: "Previsão de desmatamento" }],
      subgroups: [],
    });
  });

  it("aceita subgrupos em qualquer categoria e omite os vazios", () => {
    const definitions: LayerSubgroupDefinition[] = [
      {
        key: "vazio",
        parentCategory: "Dados Ambientais",
        namePrefixes: ["Nada"],
      },
      {
        key: "solo",
        parentCategory: "Dados Ambientais",
        namePrefixes: ["Solo"],
      },
    ];

    const grouped = splitIntoLayerSubgroups(
      "Dados Ambientais",
      [{ name: "Solo exposto" }, { name: "Cobertura" }],
      byName,
      definitions,
    );

    expect(grouped.items.map(byName)).toEqual(["Cobertura"]);
    expect(grouped.subgroups).toEqual([
      { key: "solo", items: [{ name: "Solo exposto" }] },
    ]);
  });
});

describe("flattenLayerSubgroups", () => {
  it("coloca os soltos antes dos subgrupos", () => {
    expect(
      flattenLayerSubgroups({
        items: ["a"],
        subgroups: [
          { key: "x", items: ["b"] },
          { key: "y", items: ["c"] },
        ],
      }),
    ).toEqual(["a", "b", "c"]);
  });
});
