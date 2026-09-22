import { beforeEach, describe, expect, it } from "vitest";

import { vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { MunicipalSpreadsheetStatisticsSource } from "@/contracts/municipalSpreadsheet";
import type { SpreadsheetTable } from "@/infrastructure/google-drive/spreadsheetReader";
import { clearDraftSpreadsheetSnapshots } from "@/services/indexCatalog/draftSpreadsheetSnapshot";
import { readSpreadsheetClassificationSample } from "@/services/indexCatalog/spreadsheetClassificationSample";

const source: MunicipalSpreadsheetStatisticsSource = {
  kind: "municipal-spreadsheet",
  spreadsheetUrl: "https://docs.google.com/spreadsheets/d/planilha/edit",
  fileId: "planilha",
  valuePrefix: "pib",
  aggregation: "sum",
};

/** Doze municípios paraibanos, e um total estadual que não é município. */
function buildTable(): SpreadsheetTable {
  return {
    header: ["CD_MUN", "NM_MUN", "SIGLA_UF", "pib_2010", "pib_2020"],
    rows: [
      ...Array.from({ length: 12 }, (_row, position) => [
        `25075${String(position).padStart(2, "0")}`,
        `Município ${position}`,
        "PB",
        position + 1,
        (position + 1) * 100,
      ]),
      ["25", "Paraíba", "PB", 9_000, 900_000],
    ],
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

describe("readSpreadsheetClassificationSample", () => {
  it("lê o período mais recente quando nenhum é pedido", async () => {
    const sample = await readSpreadsheetClassificationSample(
      source,
      undefined,
      { readSpreadsheet: reader.read },
    );

    expect(sample.period).toBe("2020");
    expect(sample.origin).toBe("spreadsheet");
    expect(sample.max).toBe(1200);
  });

  it("lê o período pedido", async () => {
    const sample = await readSpreadsheetClassificationSample(source, "2010", {
      readSpreadsheet: reader.read,
    });

    expect(sample.period).toBe("2010");
    expect(sample.max).toBe(12);
  });

  it("deixa de fora os territórios que não são município", async () => {
    const sample = await readSpreadsheetClassificationSample(
      source,
      undefined,
      { readSpreadsheet: reader.read },
    );

    // O total da Paraíba vale 900.000 e puxaria todos os limites para cima.
    expect(sample.count).toBe(12);
    expect(sample.max).toBe(1200);
  });

  it("reaproveita o instantâneo já lido, sem voltar ao Drive", async () => {
    await readSpreadsheetClassificationSample(source, undefined, {
      readSpreadsheet: reader.read,
    });
    await readSpreadsheetClassificationSample(source, "2010", {
      readSpreadsheet: reader.read,
    });

    expect(reader.calls).toBe(1);
  });
});
