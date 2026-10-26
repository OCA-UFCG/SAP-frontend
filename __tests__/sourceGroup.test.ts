import { describe, expect, it } from "vitest";
import { tryParsePanelLayerSourceGroup } from "@/contracts/panelLayerSourceGroup";
import { groupBySource } from "@/utils/sourceGroup";

interface Layer {
  id: string;
  sourceGroup?: { group: string; source: string } | null;
}

const brDwgd: Layer = {
  id: "indice-de-aridez-br-dwgd",
  sourceGroup: { group: "Índice de Aridez", source: "BR-DWGD" },
};
const era5Land: Layer = {
  id: "indice-de-aridez-era5-land",
  sourceGroup: { group: "indice de aridez ", source: "ERA5 Land" },
};
const cdi: Layer = { id: "indice-combinado-de-seca-cdi" };

describe("groupBySource", () => {
  it("junta os índices com o mesmo nome de grupo, sem olhar acento e caixa", () => {
    const groups = groupBySource(
      [brDwgd, cdi, era5Land],
      (layer) => layer.sourceGroup,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].map(({ item, source }) => [item.id, source])).toEqual([
      ["indice-de-aridez-br-dwgd", "BR-DWGD"],
      ["indice-de-aridez-era5-land", "ERA5 Land"],
    ]);
  });

  it("não forma grupo com um índice só", () => {
    expect(groupBySource([brDwgd, cdi], (layer) => layer.sourceGroup)).toEqual(
      [],
    );
  });
});

describe("tryParsePanelLayerSourceGroup", () => {
  it("deixa o índice num cartão comum quando o valor publicado é inválido", () => {
    expect(tryParsePanelLayerSourceGroup({ group: "Índice de Aridez" })).toBe(
      null,
    );
    expect(tryParsePanelLayerSourceGroup("Índice de Aridez")).toBe(null);
    expect(
      tryParsePanelLayerSourceGroup({
        group: " Índice de Aridez ",
        source: "ERA5 Land",
      }),
    ).toEqual({ group: "Índice de Aridez", source: "ERA5 Land" });
  });
});
