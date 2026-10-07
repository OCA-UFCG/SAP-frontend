import { describe, expect, it } from "vitest";

import { resolveReportTerritory } from "@/utils/reportTerritory";
import { getSelectableReportLayerIds } from "@/utils/reportLayerAvailability";
import type { MunicipalAvailabilityIndex } from "@/utils/municipalAvailability";
import type { PanelLayerI } from "@/utils/interfaces";

const CAMPINA_GRANDE = "2504009";

const index: MunicipalAvailabilityIndex = {
  schemaVersion: 1,
  generatedAt: "2026-01-01T00:00:00.000Z",
  layers: [{ panelLayerId: "anaseca", order: 0, periods: ["2023", "2024"] }],
  byMunicipality: { [CAMPINA_GRANDE]: { anaseca: "0-1" } },
};

function layer(
  id: string,
  periods: string[],
  statisticsSource?: PanelLayerI["statisticsSource"],
) {
  return {
    id,
    statisticsSource,
    imageData: {
      schemaVersion: 1,
      type: "territorial-compact",
      classes: [{ id: "a", label: "A", color: "#fff" }],
      years: Object.fromEntries(
        periods.map((period) => [period, { imageId: `x/${period}`, values: {} }]),
      ),
    },
  } as unknown as PanelLayerI;
}

/** O território de uma chave, já garantido: o teste erra se a chave não existir. */
function territory(locationKey: string) {
  const resolved = resolveReportTerritory(locationKey);
  if (!resolved) throw new Error(`Território inexistente: ${locationKey}`);
  return resolved;
}

const publishedSource = {
  schemaVersion: 1,
  sourceRevision: "rev-1",
} as unknown as PanelLayerI["statisticsSource"];

describe("getSelectableReportLayerIds", () => {
  // Regressão: o índice de disponibilidade é gerado só a partir das partições
  // `municipalAnalysis`, então uma camada do catálogo nunca aparecia nele e
  // ficava permanentemente desmarcável no formulário do relatório.
  it("oferece a camada do catálogo pelos períodos que ela publicou", () => {
    const selectable = getSelectableReportLayerIds(
      [layer("indice-catalogo", ["2023", "2024"], publishedSource)],
      index,
      territory(CAMPINA_GRANDE),
      "2024",
    );

    expect(selectable.has("indice-catalogo")).toBe(true);
  });

  it("cai no período publicado mais próximo quando o pedido é posterior", () => {
    const selectable = getSelectableReportLayerIds(
      [layer("indice-catalogo", ["2023", "2024"], publishedSource)],
      index,
      territory(CAMPINA_GRANDE),
      "2026",
    );

    expect(selectable.has("indice-catalogo")).toBe(true);
  });

  it("não oferece a camada do catálogo que não publicou nenhum período", () => {
    const selectable = getSelectableReportLayerIds(
      [layer("indice-vazio", [], publishedSource)],
      index,
      territory(CAMPINA_GRANDE),
      "2024",
    );

    expect(selectable.has("indice-vazio")).toBe(false);
  });

  it("mantém a camada legada decidindo pelo índice, e não pelos períodos publicados", () => {
    const selectable = getSelectableReportLayerIds(
      [layer("anaseca", ["2023", "2024"]), layer("deg", ["2023", "2024"])],
      index,
      territory(CAMPINA_GRANDE),
      "2024",
    );

    expect(selectable.has("anaseca")).toBe(true);
    // `deg` publica os mesmos períodos, mas não está no índice deste município.
    expect(selectable.has("deg")).toBe(false);
  });

  it("não oferece camada legada para município fora do índice", () => {
    const selectable = getSelectableReportLayerIds(
      [layer("anaseca", ["2024"])],
      index,
      territory("5200050"),
      "2024",
    );

    expect(selectable.size).toBe(0);
  });

  it("fora do município, oferece só as camadas com fonte no Earth Engine", () => {
    const selectable = getSelectableReportLayerIds(
      [
        layer("indice-catalogo", ["2024"], publishedSource),
        layer("anaseca", ["2024"]),
      ],
      index,
      territory("ba"),
      "2024",
    );

    expect(selectable.has("indice-catalogo")).toBe(true);
    // A camada legada guarda valores por município no Contentful: ela não tem
    // linha nenhuma para um estado.
    expect(selectable.has("anaseca")).toBe(false);
  });

  it("não oferece o índice que o catálogo tirou do relatório", () => {
    const excluded = layer("indice-catalogo", ["2024"], publishedSource);
    excluded.reportConfig = {
      schemaVersion: 1,
      sections: [],
      includeInReport: false,
    };

    const selectable = getSelectableReportLayerIds(
      [excluded],
      index,
      territory("br"),
      "2024",
    );

    expect(selectable.has("indice-catalogo")).toBe(false);
  });
});
