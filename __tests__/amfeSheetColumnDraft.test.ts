import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getAmfeSheetTable = vi.fn();

vi.mock("@/repositories/platform/amfeSheetRepository", () => ({
  getAmfeSheetTable,
}));

const { buildAmfeSheetColumnDraft } =
  await import("@/services/indexCatalog/amfeSheetColumnDraft");

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
    { code: "4106902", name: "Curitiba", stateCode: "PR", values: { ips: 70 } },
    { code: "5300108", name: "Brasília", stateCode: "DF", values: { ips: 80 } },
    {
      code: "2304400",
      name: "Fortaleza",
      stateCode: "CE",
      values: { ips: 60 },
    },
  ],
};

const source = {
  kind: "amfe-sheet-column" as const,
  column: "ips",
  periodKey: "2024",
  aggregation: "mean" as const,
};

function buildConfig(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    panelLayerId: "progresso-social",
    status: "draft",
    name: "Progresso Social",
    description: "…",
    category: "Dados Socioeconômicos",
    statisticsSource: source,
    classes: [
      { classIndex: 0, id: "faixa-1", label: "Até 50", color: "#FFFFCC" },
      { classIndex: 1, id: "faixa-2", label: "Acima de 50", color: "#BD0026" },
    ],
    earthEngine: {
      strategy: "single",
      sourceType: "featureCollection",
      thresholds: [50],
    },
    valueIndicator: {
      label: "Índice de Progresso Social",
      color: "#BD0026",
      measurementUnit: "pontos",
      valueType: "absolute",
    },
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("buildAmfeSheetColumnDraft", () => {
  beforeEach(() => {
    getAmfeSheetTable.mockResolvedValue(table);
  });

  it("publishes a single period, the display year chosen in the form", async () => {
    const result = await buildAmfeSheetColumnDraft(buildConfig(), source);

    expect(Object.keys(result.panelLayerImageData.years)).toEqual(["2024"]);
    expect(result.panelLayerImageData.defaultYear).toBe("2024");
    expect(result.validation.inferred.periods).toEqual(["2024"]);
  });

  it("marks the map as a municipal choropleth of the chosen column", async () => {
    const result = await buildAmfeSheetColumnDraft(buildConfig(), source);

    expect(result.mapVisualization.municipalChoropleth).toEqual({
      source: "amfe-sheet",
      column: "ips",
    });
    expect(result.mapVisualization.thresholds).toEqual([50]);
    expect(result.mapVisualization.palette).toEqual(["#FFFFCC", "#BD0026"]);
  });

  // O painel mostra um número por território; as faixas são a legenda do mapa.
  it("gives the layer a single class, the indicator itself", async () => {
    const result = await buildAmfeSheetColumnDraft(buildConfig(), source);

    expect(result.panelLayerImageData.classes).toEqual([
      {
        id: "progresso-social",
        label: "Índice de Progresso Social",
        color: "#BD0026",
      },
    ]);
  });

  it("warns that there is no time axis and no aggregate scopes", async () => {
    const result = await buildAmfeSheetColumnDraft(buildConfig(), source);

    expect(result.validation.warnings.map((warning) => warning.code)).toContain(
      "single_period",
    );
    expect(result.validation.warnings.map((warning) => warning.code)).toContain(
      "aggregate_scopes_unavailable",
    );
  });

  it("warns about the municipalities left without value", async () => {
    getAmfeSheetTable.mockResolvedValue({
      ...table,
      municipalities: [
        ...table.municipalities,
        {
          code: "1100015",
          name: "Alta Floresta",
          stateCode: "RO",
          values: { ips: null },
        },
      ],
    });

    const result = await buildAmfeSheetColumnDraft(buildConfig(), source);

    expect(
      result.validation.warnings.find(
        (warning) => warning.code === "municipalities_without_value",
      )?.message,
    ).toContain("1 município(s)");
  });

  it("refuses a column the sheet does not have", async () => {
    await expect(
      buildAmfeSheetColumnDraft(buildConfig(), {
        ...source,
        column: "coluna_inexistente",
      }),
    ).rejects.toThrow(/não existe na planilha/u);
  });

  it("refuses ranges without the limits that separate them", async () => {
    await expect(
      buildAmfeSheetColumnDraft(
        buildConfig({
          earthEngine: { strategy: "single", sourceType: "featureCollection" },
        }),
        source,
      ),
    ).rejects.toThrow(/exatamente 1 limite/u);
  });

  // A revisão entra no `panelLayer` publicado: sem os valores no cálculo, uma
  // edição na planilha não mudaria nada e o índice pareceria conferido.
  it("changes the source revision when the sheet values change", async () => {
    const first = await buildAmfeSheetColumnDraft(buildConfig(), source);

    getAmfeSheetTable.mockResolvedValue({
      ...table,
      municipalities: table.municipalities.map((municipality, position) =>
        position === 0
          ? { ...municipality, values: { ips: 11 } }
          : municipality,
      ),
    });
    const second = await buildAmfeSheetColumnDraft(buildConfig(), source);

    expect(second.statisticsSource.sourceRevision).not.toBe(
      first.statisticsSource.sourceRevision,
    );
  });
});
