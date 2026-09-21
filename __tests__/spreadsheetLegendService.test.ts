import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { MunicipalSpreadsheetStatisticsSource } from "@/contracts/municipalSpreadsheet";
import type { SpreadsheetTable } from "@/infrastructure/google-drive/spreadsheetReader";
import { clearDraftSpreadsheetSnapshots } from "@/services/indexCatalog/draftSpreadsheetSnapshot";
import { detectSpreadsheetLegend } from "@/services/indexCatalog/spreadsheetLegendService";
import type { MunicipalValueIndicator } from "@/types/indexCatalog";

const INDICATOR: MunicipalValueIndicator = {
  label: "PIB",
  measurementUnit: "mil reais",
  color: "#1B5E20",
  valueType: "absolute",
};

const source: MunicipalSpreadsheetStatisticsSource = {
  kind: "municipal-spreadsheet",
  spreadsheetUrl: "https://docs.google.com/spreadsheets/d/planilha/edit",
  fileId: "planilha",
  valuePrefix: "pib",
  aggregation: "sum",
};

/** Doze municípios paraibanos, para os quantis terem o que separar. */
function buildTable(): SpreadsheetTable {
  return {
    header: ["CD_MUN", "NM_MUN", "SIGLA_UF", "pib_2010", "pib_2020"],
    rows: Array.from({ length: 12 }, (_row, position) => [
      `25075${String(position).padStart(2, "0")}`,
      `Município ${position}`,
      "PB",
      position + 1,
      (position + 1) * 100,
    ]),
    sheetName: "Base_unida",
  };
}

class FakeSpreadsheetReader {
  calls = 0;
  read = async () => {
    this.calls += 1;
    return buildTable();
  };
}

let reader: FakeSpreadsheetReader;

beforeEach(() => {
  clearDraftSpreadsheetSnapshots();
  reader = new FakeSpreadsheetReader();
});

describe("detectSpreadsheetLegend", () => {
  it("usa o período mais recente da planilha", async () => {
    const legend = await detectSpreadsheetLegend(
      { source, indicator: INDICATOR },
      { readSpreadsheet: reader.read },
    );

    expect(legend.periodKey).toBe("2020");
    expect(legend.sampleCount).toBe(12);
    expect(legend.thresholds).toHaveLength(4);
  });

  it("aceita um período anterior quando pedido", async () => {
    const legend = await detectSpreadsheetLegend(
      { source, indicator: INDICATOR, periodKey: "2010", rangeCount: 3 },
      { readSpreadsheet: reader.read },
    );

    expect(legend.periodKey).toBe("2010");
    expect(legend.ranges).toHaveLength(3);
  });

  /**
   * Os territórios agregados são uma ordem de grandeza maiores que qualquer
   * município: incluí-los empurraria todos os limites para cima e pintaria o
   * país inteiro com a primeira cor.
   */
  it("calcula as faixas só com os valores municipais", async () => {
    const legend = await detectSpreadsheetLegend(
      { source, indicator: INDICATOR },
      { readSpreadsheet: reader.read },
    );

    // A soma do Brasil é 7.800; nenhum limite pode chegar perto dela.
    expect(Math.max(...legend.thresholds)).toBeLessThan(1_300);
  });

  it("reaproveita o instantâneo que a prévia já leu", async () => {
    await detectSpreadsheetLegend(
      { source, indicator: INDICATOR },
      { readSpreadsheet: reader.read },
    );
    await detectSpreadsheetLegend(
      { source, indicator: INDICATOR, rangeCount: 4 },
      { readSpreadsheet: reader.read },
    );

    expect(reader.calls).toBe(1);
  });
});
