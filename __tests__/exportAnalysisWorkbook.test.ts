import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildAnalysisWorkbook } from "@/components/Amfe/exportAnalysisWorkbook";
import type { AnalyzePayload, Cities } from "@/utils/amfeInterfaces";

/** Identidade: o teste checa a estrutura, não a tradução. */
const t = (key: string) => key;

const cities: Cities = {
  "2504108": { name: "Cajazeiras", UF: "PB", classification: 3 },
  "2507507": { name: "João Pessoa", UF: "PB", classification: 0 },
};

const payload: AnalyzePayload = {
  criteria: [
    { name: "ips", value: 0.6, is_benefit: true },
    { name: "ivcm", value: 0.4, is_benefit: false },
  ],
  thresholds: { indifference: 0.02, preference: 0.1, veto: 0.5 },
  model: { version: "1.0" },
  typeScenario: "optimistic",
  ranking: { level: "state" },
  interestArea: { type: "state", value: "PB" },
};

const rowsOf = (workbook: XLSX.WorkBook, sheetName: string) =>
  XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[sheetName],
  );

describe("buildAnalysisWorkbook", () => {
  it("produces one data sheet and one specification sheet", () => {
    const workbook = buildAnalysisWorkbook(XLSX, cities, payload, t);

    expect(workbook.SheetNames).toEqual(["dadosSheet", "especificacoesSheet"]);
  });

  it("keeps the IBGE code alongside each municipality", () => {
    const rows = rowsOf(buildAnalysisWorkbook(XLSX, cities, payload, t), "dadosSheet");

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      city_id: "2504108",
      name: "Cajazeiras",
      classification: 3,
    });
  });

  it("records every criterion with its benefit or cost direction", () => {
    const rows = rowsOf(
      buildAnalysisWorkbook(XLSX, cities, payload, t),
      "especificacoesSheet",
    );

    expect(rows[0]).toMatchObject({
      secaoCol: "criterios",
      parametroCol: "ips",
      valorCol: 0.6,
      observacaoCol: "beneficio",
    });
    expect(rows[1]).toMatchObject({
      parametroCol: "ivcm",
      observacaoCol: "custo",
    });
  });

  it("records the thresholds, scenario, ranking, area and model version", () => {
    const rows = rowsOf(
      buildAnalysisWorkbook(XLSX, cities, payload, t),
      "especificacoesSheet",
    );
    const values = rows.map((row) => row.parametroCol);

    expect(values).toContain("indiferenca");
    expect(values).toContain("preferencia");
    expect(values).toContain("veto");
    expect(values).toContain("tipo");
    expect(values).toContain("nivel");
    expect(values).toContain("interestAreaValue");
    expect(values).toContain("versao");
  });

  it("labels a pessimistic scenario as such", () => {
    const rows = rowsOf(
      buildAnalysisWorkbook(
        XLSX,
        cities,
        { ...payload, typeScenario: "pessimistic" },
        t,
      ),
      "especificacoesSheet",
    );
    const scenarioRow = rows.find((row) => row.parametroCol === "tipo");

    expect(scenarioRow?.valorCol).toBe("pessimista");
  });
});
