import { describe, expect, it } from "vitest";

import {
  buildSpreadsheetDownloadUrls,
  parseGoogleFileId,
} from "@/utils/municipalSpreadsheetLink";
import {
  assertSpreadsheetColumns,
  listSpreadsheetValuePrefixes,
  readMunicipalSpreadsheetRows,
  resolveSpreadsheetPeriodColumns,
} from "@/utils/municipalSpreadsheetTable";

const HEADER = [
  "CD_MUN",
  "NM_MUN",
  "NM_RGI",
  "NM_RGINT",
  "NM_UF",
  "SIGLA_UF",
  "NM_REGIAO",
  "AREA_KM2",
  "BIOMA_PRED",
  "SEMIÁRIDO",
  "ASD_ENTORN",
  "pib_2010",
  "pib_2020",
];

const ROW = [
  "2507507",
  "João Pessoa",
  "João Pessoa",
  "João Pessoa",
  "Paraíba",
  "PB",
  "Nordeste",
  211.5,
  "Mata Atlântica",
  "Não",
  "ASD",
  1000,
  2000,
];

describe("parseGoogleFileId", () => {
  it("reads the id from the link the Google share button produces", () => {
    expect(
      parseGoogleFileId(
        "https://docs.google.com/spreadsheets/d/1OgW6thfyXJX1TlW225BwNg4qvpXHzYAu/edit?usp=drive_link&ouid=111",
      ),
    ).toBe("1OgW6thfyXJX1TlW225BwNg4qvpXHzYAu");
  });

  it("reads the id from a drive open link and from the bare id", () => {
    expect(
      parseGoogleFileId(
        "https://drive.google.com/open?id=1sazVqPQpWtuvMCGTdVqVSBzDLlFEbZSq",
      ),
    ).toBe("1sazVqPQpWtuvMCGTdVqVSBzDLlFEbZSq");
    expect(parseGoogleFileId("1sazVqPQpWtuvMCGTdVqVSBzDLlFEbZSq")).toBe(
      "1sazVqPQpWtuvMCGTdVqVSBzDLlFEbZSq",
    );
  });

  it("names the offending link when it has no file id", () => {
    expect(() => parseGoogleFileId("https://example.test/planilha")).toThrow(
      /https:\/\/example.test\/planilha/,
    );
  });

  it("offers the native sheet export before the binary download", () => {
    const [first, second] = buildSpreadsheetDownloadUrls("abc");
    expect(first).toContain("/spreadsheets/d/abc/export?format=xlsx");
    expect(second).toContain("uc?export=download&id=abc");
  });
});

describe("spreadsheet period columns", () => {
  it("turns every {prefixo}_{ano} column into a period, in year order", () => {
    expect(
      resolveSpreadsheetPeriodColumns(["pib_2020", "pib_2010"], "pib"),
    ).toEqual([
      { periodKey: "2010", column: "pib_2010" },
      { periodKey: "2020", column: "pib_2020" },
    ]);
  });

  it("ignores columns of another indicator in the same sheet", () => {
    expect(
      resolveSpreadsheetPeriodColumns(["pib_2010", "idhm_2010"], "idhm"),
    ).toEqual([{ periodKey: "2010", column: "idhm_2010" }]);
  });

  it("lists the prefixes the sheet offers, for the form to suggest them", () => {
    expect(listSpreadsheetValuePrefixes(HEADER)).toEqual(["pib"]);
  });

  it("names the available prefixes when the chosen one has no column", () => {
    expect(() => assertSpreadsheetColumns(HEADER, [], "populacao")).toThrow(
      /populacao_\{ano\}.*pib/su,
    );
  });

  it("names the missing convention columns", () => {
    expect(() =>
      assertSpreadsheetColumns(
        ["NM_MUN", "pib_2010"],
        [{ periodKey: "2010", column: "pib_2010" }],
        "pib",
      ),
    ).toThrow(/CD_MUN, SIGLA_UF/u);
  });
});

describe("readMunicipalSpreadsheetRows", () => {
  const periodColumns = [
    { periodKey: "2010", column: "pib_2010" },
    { periodKey: "2020", column: "pib_2020" },
  ];

  it("reads the territorial cuts of a municipality", () => {
    const { rows } = readMunicipalSpreadsheetRows(HEADER, [ROW], periodColumns);

    expect(rows[0]).toMatchObject({
      municipalityCode: "2507507",
      label: "João Pessoa - PB",
      stateCode: "PB",
      region: "Nordeste",
      biome: "Mata Atlântica",
      isSemiarid: false,
      isAsdOrSurroundings: true,
      values: [1000, 2000],
    });
  });

  it("counts Entorno as part of the ASD cut and Sim as semiarid", () => {
    const row = [...ROW];
    row[9] = "Sim";
    row[10] = "Entorno";
    const { rows } = readMunicipalSpreadsheetRows(HEADER, [row], periodColumns);

    expect(rows[0].isSemiarid).toBe(true);
    expect(rows[0].isAsdOrSurroundings).toBe(true);
  });

  it("reads a Brazilian decimal written with comma and thousand separators", () => {
    const row = [...ROW];
    row[11] = "1.046.342,5";
    const { rows } = readMunicipalSpreadsheetRows(HEADER, [row], periodColumns);

    expect(rows[0].values[0]).toBe(1046342.5);
  });

  // Regressão: apagar todo ponto antes de converter lia o IDHM "0.763" de uma
  // coluna de texto como 763 — todo município multiplicado por mil, sem erro
  // nenhum, porque o número resultante é finito e passa pela validação.
  it("reads a decimal written with a point instead of multiplying it by a thousand", () => {
    const first = [...ROW];
    const second = [...ROW];
    first[11] = "0.763";
    second[11] = "0.612";
    second[0] = "2504009";
    const { rows } = readMunicipalSpreadsheetRows(
      HEADER,
      [first, second],
      periodColumns,
    );

    expect(rows.map((row) => row.values[0])).toEqual([0.763, 0.612]);
  });

  it("reads the American format, where the comma is the thousand separator", () => {
    const row = [...ROW];
    row[11] = "1,046,342.5";
    const { rows } = readMunicipalSpreadsheetRows(HEADER, [row], periodColumns);

    expect(rows[0].values[0]).toBe(1046342.5);
  });

  it("takes the convention from the column, not from the cell", () => {
    const withThousands = [...ROW];
    const alone = [...ROW];
    withThousands[11] = "1.046.342";
    alone[11] = "2.500";
    alone[0] = "2504009";
    const { rows } = readMunicipalSpreadsheetRows(
      HEADER,
      [withThousands, alone],
      periodColumns,
    );

    expect(rows.map((row) => row.values[0])).toEqual([1046342, 2500]);
  });

  it("reports the column it could not decide instead of guessing in silence", () => {
    const row = [...ROW];
    row[11] = "2.500";
    const reading = readMunicipalSpreadsheetRows(HEADER, [row], periodColumns);

    expect(reading.rows[0].values[0]).toBe(2.5);
    expect(reading.ambiguousDecimalColumns).toEqual([
      { column: "pib_2010", sample: "2.500" },
    ]);
  });

  it("does not call a column ambiguous when the sheet already gave it as a number", () => {
    const reading = readMunicipalSpreadsheetRows(HEADER, [ROW], periodColumns);

    expect(reading.ambiguousDecimalColumns).toEqual([]);
    expect(reading.rows[0].values).toEqual([1000, 2000]);
  });

  it("keeps an empty cell as missing instead of turning it into zero", () => {
    const row = [...ROW];
    row[11] = null;
    const { rows } = readMunicipalSpreadsheetRows(HEADER, [row], periodColumns);

    expect(rows[0].values).toEqual([null, 2000]);
  });

  it("skips a footer row without an IBGE code instead of failing", () => {
    const footer = ["Fonte: IBGE", ...new Array(12).fill(null)];
    const reading = readMunicipalSpreadsheetRows(
      HEADER,
      [ROW, footer],
      periodColumns,
    );

    expect(reading.rows).toHaveLength(1);
    expect(reading.skippedRowCount).toBe(1);
  });

  it("matches the convention columns ignoring accent and case", () => {
    const header = HEADER.map((name) =>
      name === "SEMIÁRIDO" ? "semiarido" : name,
    );
    const row = [...ROW];
    row[9] = "Sim";
    const { rows } = readMunicipalSpreadsheetRows(header, [row], periodColumns);

    expect(rows[0].isSemiarid).toBe(true);
  });
});
