import { describe, expect, it } from "vitest";

import { buildEmbeddedTerritorialAnalysisViewModel } from "@/components/analysis/analysis.mappers";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";
import type { PanelLayerI } from "@/utils/interfaces";

const imageData: CompactTerritorialAnalysisDataset = {
  schemaVersion: 1,
  type: "territorial-compact",
  classes: [
    { id: "sem-seca", label: "Sem seca", color: "#FFFFFF" },
    { id: "seca-fraca", label: "Seca fraca", color: "#FAFF6D" },
    { id: "seca-grave", label: "Seca grave", color: "#BE7B3A" },
  ],
  locations: { br: "Brasil" },
  years: {
    "2026-08": {
      imageId: "projects/teste/assets/monitor",
      values: {
        br: [60, 30, 10],
        pb: [0, 70, 30],
        pe: [100, 0, 0],
      },
    },
  },
};

function buildLayer(severityOrder?: string[]): PanelLayerI {
  return {
    sys: { id: "x" },
    id: "monitor",
    name: "Monitor",
    description: "",
    imageData,
    reportConfig: severityOrder
      ? {
          schemaVersion: 1,
          sections: [],
          severity: { order: severityOrder },
        }
      : null,
  } as PanelLayerI;
}

function rankingOf(layer: PanelLayerI) {
  return buildEmbeddedTerritorialAnalysisViewModel(layer, "2026-08", "br")!
    .rankingGroups;
}

describe("ranking de estados no Monitoramento", () => {
  it("põe a classe mais grave em cima quando o catálogo declara a ordem", () => {
    const groups = rankingOf(
      buildLayer(["sem-seca", "seca-fraca", "seca-grave"]),
    );

    expect(groups.map((group) => group.id)).toEqual([
      "seca-grave",
      "seca-fraca",
      "sem-seca",
    ]);
  });

  it("segue a ordem da legenda quando o índice não tem ordem de gravidade", () => {
    const groups = rankingOf(buildLayer());

    expect(groups.map((group) => group.id)).toEqual([
      "sem-seca",
      "seca-fraca",
      "seca-grave",
    ]);
  });

  it("tira da classe o estado que não tem valor nela", () => {
    const groups = rankingOf(
      buildLayer(["sem-seca", "seca-fraca", "seca-grave"]),
    );
    const byId = Object.fromEntries(groups.map((group) => [group.id, group]));

    expect(byId["sem-seca"].allItems?.map((item) => item.id)).toEqual(["pe"]);
    expect(byId["seca-grave"].allItems?.map((item) => item.id)).toEqual(["pb"]);
  });
});
