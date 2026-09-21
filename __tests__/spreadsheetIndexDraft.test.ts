import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { validateImageDataContract } from "@/contracts/imageDataContract.mjs";
import type { MunicipalSpreadsheetStatisticsSource } from "@/contracts/municipalSpreadsheet";
import type { SpreadsheetTable } from "@/infrastructure/google-drive/spreadsheetReader";
import { buildSpreadsheetIndexDraft } from "@/services/indexCatalog/spreadsheetIndexDraft";
import type { IndexCatalogConfigV2 } from "@/types/indexCatalog";
import type { PublishedMunicipalSpreadsheetSource } from "@/contracts/geeStatistics";

const HEADER = [
  "CD_MUN",
  "NM_MUN",
  "NM_UF",
  "SIGLA_UF",
  "NM_REGIAO",
  "BIOMA_PRED",
  "SEMIÁRIDO",
  "ASD_ENTORN",
  "pib_2010",
  "pib_2020",
];

const ROWS = [
  [
    "2507507",
    "João Pessoa",
    "Paraíba",
    "PB",
    "Nordeste",
    "Mata Atlântica",
    "Não",
    "ASD",
    10,
    20,
  ],
  [
    "2504009",
    "Campina Grande",
    "Paraíba",
    "PB",
    "Nordeste",
    "Caatinga",
    "Sim",
    "ASD",
    30,
    null,
  ],
];

const source: MunicipalSpreadsheetStatisticsSource = {
  kind: "municipal-spreadsheet",
  spreadsheetUrl: "https://docs.google.com/spreadsheets/d/planilha/edit",
  fileId: "planilha",
  valuePrefix: "pib",
  aggregation: "sum",
};

const config = {
  panelLayerId: "pib",
  statisticsSource: source,
  classes: [
    { classIndex: 0, id: "baixo", label: "Baixo", color: "#FEE" },
    { classIndex: 1, id: "alto", label: "Alto", color: "#F00" },
  ],
  earthEngine: {
    strategy: "single",
    sourceType: "municipalChoropleth",
    thresholds: [25],
  },
  valueIndicator: {
    label: "PIB municipal",
    color: "#F00",
    measurementUnit: "R$",
    valueType: "absolute",
  },
} as unknown as IndexCatalogConfigV2;

/** Devolve a planilha de teste sem tocar a rede. */
class FakeSpreadsheetReader {
  constructor(private readonly table: SpreadsheetTable) {}
  read = async () => this.table;
}

/** Conta quantas vezes o Contentful foi chamado para gravar um asset. */
class FakeAssetStore {
  calls = 0;
  save = async () => {
    this.calls += 1;
    return { assetId: "asset-1", url: "https://assets.test/pib.json" };
  };
}

function buildDraft(
  table: SpreadsheetTable = {
    header: HEADER,
    rows: ROWS,
    sheetName: "Base_unida",
  },
) {
  const reader = new FakeSpreadsheetReader(table);
  return {
    result: buildSpreadsheetIndexDraft(config, source, {
      readSpreadsheet: reader.read,
    }),
  };
}

describe("buildSpreadsheetIndexDraft", () => {
  it("turns each {prefixo}_{ano} column into a period", async () => {
    const { result } = buildDraft();

    expect((await result).validation.inferred.periods).toEqual([
      "2010",
      "2020",
    ]);
    expect((await result).validation.inferred.defaultPeriod).toBe("2020");
  });

  it("publishes a map that is a municipal choropleth, with no Earth Engine asset", async () => {
    const { panelLayerImageData, mapVisualization } = await buildDraft().result;

    expect(mapVisualization.sourceType).toBe("municipalChoropleth");
    expect(mapVisualization.palette).toEqual(["#FEE", "#F00"]);
    expect(mapVisualization.thresholds).toEqual([25]);
    expect(
      Object.values(panelLayerImageData.years).every(
        (year) => !("imageId" in year),
      ),
    ).toBe(true);
  });

  it("produces an imageData the publishing contract accepts", async () => {
    const { panelLayerImageData } = await buildDraft().result;

    expect(
      validateImageDataContract(panelLayerImageData, {
        context: "panelLayerPublish",
      }),
    ).toEqual({ ok: true, errors: [] });
  });

  it("keeps the territorial values out of imageData and inside the snapshot", async () => {
    const { panelLayerImageData, spreadsheetSnapshot } =
      await buildDraft().result;

    expect(panelLayerImageData.years["2010"].values).toEqual({});
    expect(spreadsheetSnapshot?.values.br).toEqual([40, 20]);
    expect(spreadsheetSnapshot?.values["5_semiarido-semiarido-total"]).toEqual([
      30,
      null,
    ]);
  });

  // Regressão: validar gravava o instantâneo reaproveitando o asset do índice
  // publicado, então "Gerar prévia" trocava o arquivo que a produção estava
  // lendo — e uma publicação recusada logo depois já tinha alterado o dado.
  it("does not write anything to Contentful while validating", async () => {
    const assets = new FakeAssetStore();
    const published = {
      ...config,
      status: "published",
      validatedStatisticsSource: {
        ...source,
        schemaVersion: 1,
        sourceRevision: "antigo",
        snapshot: { assetId: "asset-1", url: "https://assets.test/pib.json" },
      },
    } as unknown as IndexCatalogConfigV2;

    const build = await buildSpreadsheetIndexDraft(published, source, {
      readSpreadsheet: new FakeSpreadsheetReader({
        header: HEADER,
        rows: ROWS,
        sheetName: "Base_unida",
      }).read,
    });

    expect(assets.calls).toBe(0);
    // O ponteiro continua no arquivo que a versão publicada serve.
    expect(
      (build.statisticsSource as PublishedMunicipalSpreadsheetSource).snapshot,
    ).toEqual({ assetId: "asset-1", url: "https://assets.test/pib.json" });
  });

  it("warns about the municipalities left without a value", async () => {
    const { validation } = await buildDraft().result;

    expect(validation.warnings.map((warning) => warning.code)).toContain(
      "spreadsheet_missing_values",
    );
    expect(validation.warnings[0].message).toContain("2020 (1)");
  });

  it("warns when it could not tell a thousand separator from a decimal point", async () => {
    const { result } = buildDraft({
      header: HEADER,
      rows: ROWS.map((row) => [...row.slice(0, 8), "2.500", "3.100"]),
      sheetName: "Base_unida",
    });

    const warning = (await result).validation.warnings.find(
      (issue) => issue.code === "spreadsheet_ambiguous_decimal",
    );
    expect(warning?.message).toContain('pib_2010 (ex.: "2.500")');
  });

  it("refuses a sheet without any column of the chosen indicator", async () => {
    const { result } = buildDraft({
      header: ["CD_MUN", "NM_MUN", "SIGLA_UF", "idhm_2010"],
      rows: [],
      sheetName: "Base_unida",
    });

    await expect(result).rejects.toThrow(/pib_\{ano\}/u);
  });

  it("refuses a sheet whose rows have no municipality code", async () => {
    const { result } = buildDraft({
      header: HEADER,
      rows: [["Fonte: IBGE", ...new Array(9).fill(null)]],
      sheetName: "Base_unida",
    });

    await expect(result).rejects.toThrow(/CD_MUN/u);
  });

  it("refuses a colour range set that the thresholds cannot separate", async () => {
    await expect(
      buildSpreadsheetIndexDraft(
        {
          ...config,
          earthEngine: { ...config.earthEngine, thresholds: [] },
        } as IndexCatalogConfigV2,
        source,
        {
          readSpreadsheet: new FakeSpreadsheetReader({
            header: HEADER,
            rows: ROWS,
            sheetName: "Base_unida",
          }).read,
        },
      ),
    ).rejects.toThrow(/exatamente 1 limite/u);
  });
});
