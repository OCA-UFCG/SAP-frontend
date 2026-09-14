import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getAmfeSheetTable = vi.fn();

vi.mock("@/repositories/platform/amfeSheetRepository", () => ({
  getAmfeSheetTable,
}));

vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayerById: vi.fn(),
}));

const { buildSheetChoropleth } =
  await import("@/repositories/platform/amfeSheetChoroplethCache");

const table = {
  criteria: [{ column: "ips", label: "IPS", unit: "", description: "" }],
  municipalities: [
    {
      code: "2507507",
      name: "João Pessoa",
      stateCode: "PB",
      values: { ips: 10 },
    },
    {
      code: "2504009",
      name: "Campina Grande",
      stateCode: "PB",
      values: { ips: 50 },
    },
    {
      code: "3550308",
      name: "São Paulo",
      stateCode: "SP",
      values: { ips: 90 },
    },
    {
      code: "1100015",
      name: "Alta Floresta",
      stateCode: "RO",
      values: { ips: null },
    },
  ],
};

const mapVisualization = {
  municipalChoropleth: { source: "amfe-sheet" as const, column: "ips" },
  palette: ["#FFFFCC", "#FD8D3C", "#BD0026"],
  thresholds: [40, 80],
};

describe("buildSheetChoropleth", () => {
  beforeEach(() => {
    getAmfeSheetTable.mockResolvedValue(table);
  });

  it("puts each municipality in the range its value falls into", async () => {
    const result = await buildSheetChoropleth(mapVisualization);

    expect(result?.classificationByCode).toEqual({
      "2507507": 0,
      "2504009": 1,
      "3550308": 2,
    });
    expect(result?.palette).toEqual(mapVisualization.palette);
  });

  // Um município sem valor é "sem dado", e não a primeira faixa: pintá-lo de
  // amarelo afirmaria um número que a planilha não tem.
  it("lists the municipalities without value as excluded", async () => {
    const result = await buildSheetChoropleth(mapVisualization);

    expect(result?.excludedCodes).toEqual(["1100015"]);
  });

  it("ignores a layer that is not painted from the sheet", async () => {
    expect(await buildSheetChoropleth({ sourceType: "image" })).toBeNull();
    expect(await buildSheetChoropleth(undefined)).toBeNull();
  });

  // A legenda mostra uma cor por faixa: com a paleta e os limites fora de
  // sincronia o mapa pintaria uma cor que a legenda não explica.
  it("refuses a palette that does not have one more color than limits", async () => {
    await expect(
      buildSheetChoropleth({ ...mapVisualization, thresholds: [40] }),
    ).rejects.toThrow(/uma cor a mais que os limites/u);
  });
});
