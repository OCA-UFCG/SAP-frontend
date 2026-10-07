import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { MunicipalSpreadsheetStatisticsSource } from "@/contracts/municipalSpreadsheet";
import type { SpreadsheetTable } from "@/infrastructure/google-drive/spreadsheetReader";
import {
  clearDraftSpreadsheetSnapshots,
  getDraftSpreadsheetSnapshot,
  rememberDraftSpreadsheetSnapshot,
} from "@/services/indexCatalog/draftSpreadsheetSnapshot";

const TABLE: SpreadsheetTable = {
  header: ["CD_MUN", "NM_MUN", "SIGLA_UF", "pib_2020"],
  rows: [["2507507", "João Pessoa", "PB", 10]],
  sheetName: "Base_unida",
};

const source: MunicipalSpreadsheetStatisticsSource = {
  kind: "municipal-spreadsheet",
  spreadsheetUrl: "https://docs.google.com/spreadsheets/d/planilha/edit",
  fileId: "planilha",
  valuePrefix: "pib",
  aggregation: "sum",
};

/** Conta as idas ao Drive, que é o que este módulo existe para evitar. */
class FakeSpreadsheetReader {
  calls = 0;

  read = async () => {
    this.calls += 1;
    return TABLE;
  };
}

let reader: FakeSpreadsheetReader;

beforeEach(() => {
  clearDraftSpreadsheetSnapshots();
  reader = new FakeSpreadsheetReader();
});

describe("getDraftSpreadsheetSnapshot", () => {
  it("reads the sheet once and serves the next request from memory", async () => {
    await getDraftSpreadsheetSnapshot(source, { readSpreadsheet: reader.read });
    const second = await getDraftSpreadsheetSnapshot(source, {
      readSpreadsheet: reader.read,
    });

    expect(reader.calls).toBe(1);
    expect(second.values.br).toEqual([10]);
  });

  // Painel, mapa e relatório da prévia pedem os valores ao mesmo tempo: sem o
  // dedupe, abrir a prévia baixaria a mesma planilha três vezes.
  it("serves simultaneous requests from a single read", async () => {
    const both = Promise.all([
      getDraftSpreadsheetSnapshot(source, { readSpreadsheet: reader.read }),
      getDraftSpreadsheetSnapshot(source, { readSpreadsheet: reader.read }),
    ]);

    await both;
    expect(reader.calls).toBe(1);
  });

  it("uses what the validation already calculated instead of reading again", async () => {
    const fromValidation = await getDraftSpreadsheetSnapshot(source, {
      readSpreadsheet: reader.read,
    });
    clearDraftSpreadsheetSnapshots();
    rememberDraftSpreadsheetSnapshot(source, fromValidation);
    reader.calls = 0;

    await getDraftSpreadsheetSnapshot(source, { readSpreadsheet: reader.read });

    expect(reader.calls).toBe(0);
  });

  it("keeps the snapshots of different sheets apart", async () => {
    await getDraftSpreadsheetSnapshot(source, { readSpreadsheet: reader.read });
    await getDraftSpreadsheetSnapshot(
      { ...source, aggregation: "mean" },
      { readSpreadsheet: reader.read },
    );

    expect(reader.calls).toBe(2);
  });
});
