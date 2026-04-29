import { describe, expect, it } from "vitest";

import { buildEmbeddedTerritorialAnalysisViewModel } from "@/components/analysis/analysis.mappers";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";
import type { PanelLayerI } from "@/utils/interfaces";

function buildLayer(imageData: CompactTerritorialAnalysisDataset): PanelLayerI {
  return {
    sys: { id: "layer-1" },
    id: "layer-1",
    name: "Camada de teste",
    description: "",
    previewMap: { url: "/preview.png" },
    imageData,
  };
}

describe("analysis.mappers", () => {
  it("shows all classes and ranks each one by its own top 5 positive states", () => {
    const layer = buildLayer({
      schemaVersion: 1,
      type: "territorial-compact",
      defaultYear: "2024",
      classes: [
        { id: "a", label: "Classe A", color: "#111111" },
        { id: "b", label: "Classe B", color: "#222222" },
        { id: "c", label: "Classe C", color: "#333333" },
        { id: "d", label: "Classe D", color: "#444444" },
        { id: "e", label: "Classe E", color: "#555555" },
      ],
      locations: {
        br: "Brasil",
        ac: "Acre",
        se: "Sergipe",
        sp: "Sao Paulo",
        rj: "Rio de Janeiro",
        mg: "Minas Gerais",
        ba: "Bahia",
      },
      years: {
        "2024": {
          imageId: "img-2024",
          valuesScale: 1,
          values: {
            br: [30, 25, 20, 15, 10],
            ac: [55, 20, 15, 5, 5],
            se: [84, 10, 5, 0, 1],
            sp: [30, 55, 10, 5, 0],
            rj: [15, 65, 15, 5, 0],
            mg: [12, 60, 18, 10, 0],
            ba: [20, 40, 25, 0, 0],
          },
        },
      },
    });

    const model = buildEmbeddedTerritorialAnalysisViewModel(
      layer,
      "2024",
      "br",
    );

    expect(model).not.toBeNull();
    expect(model?.rankingGroups).toHaveLength(5);
    expect(model?.rankingGroups.map((group) => group.label)).toEqual([
      "Classe A",
      "Classe B",
      "Classe C",
      "Classe D",
      "Classe E",
    ]);
    expect(model?.rankingGroups[0]?.tone).toEqual({
      bg: "rgba(17, 17, 17, 0.16)",
      color: "#111111",
      border: "rgba(17, 17, 17, 0.4)",
    });

    expect(model?.rankingGroups[0]?.total).toBe(6);
    expect(model?.rankingGroups[0]?.items.map((item) => item.id)).toEqual([
      "se",
      "ac",
      "sp",
      "ba",
      "rj",
    ]);
    expect(model?.rankingGroups[1]?.total).toBe(6);
    expect(model?.rankingGroups[1]?.items.map((item) => item.id)).toEqual([
      "rj",
      "mg",
      "sp",
      "ba",
      "ac",
    ]);
    expect(
      model?.rankingGroups[1]?.items.map((item) => item.trailingLabel),
    ).toEqual(["65.0%", "60.0%", "55.0%", "40.0%", "20.0%"]);
    expect(model?.rankingGroups[3]?.items.map((item) => item.id)).toEqual([
      "mg",
      "ac",
      "sp",
      "rj",
    ]);
    expect(model?.rankingGroups[4]?.total).toBe(2);
    expect(model?.rankingGroups[4]?.items.map((item) => item.id)).toEqual([
      "ac",
      "se",
    ]);
    expect(
      model?.rankingGroups[4]?.items.map((item) => item.trailingLabel),
    ).toEqual(["5.0%", "1.0%"]);
  });
});
