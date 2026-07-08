import { describe, expect, it } from "vitest";
import type { MunicipalReportData, MunicipalReportTemplateDocument } from "@/contracts/municipalReport";
import { buildMunicipalReportVariableCatalog, parseMunicipalReportTemplate, resolveMunicipalReportTemplate } from "@/utils/municipalReportTemplate";

const report: MunicipalReportData = {
  schemaVersion: 1,
  generatedAt: "2026-07-07T00:00:00.000Z",
  requestedPeriod: "2026",
  municipality: { code: "3200300", name: "Alfredo Chaves", uf: "ES" },
  analyses: [],
  templateVariables: { municipio: "Alfredo Chaves", percentual_seca: 52, periodo_seca: "2026-04", classe_seca: null },
};

function template(text: string): MunicipalReportTemplateDocument {
  return { id: "test", version: "1", origin: "local", updatedAt: "2026-07-07T00:00:00.000Z", text };
}

describe("municipal report templates", () => {
  it("parses report and dynamic analysis markers", () => {
    const parsed = parseMunicipalReportTemplate(template("[[report:introduction]]\nOlá\n[[analysis:indice_novo:situation]]\nTexto"));
    expect(parsed.errors).toEqual([]);
    expect(parsed.sections.map(({ key }) => key)).toEqual(["report:introduction", "analysis:indice_novo:situation"]);
  });

  it("interpolates typed values and treats $$ as a literal dollar sign", () => {
    const content = resolveMunicipalReportTemplate(
      template("[[analysis:seca:situation]]\n$municipio: $percentual_seca% em $periodo_seca; custo $$ 10"),
      report,
      ["seca"],
    );
    expect(content.sections[0].resolvedText).toBe("Alfredo Chaves: 52,0% em abril de 2026; custo $ 10");
  });

  it("reports unknown and null variables without publishing partial text", () => {
    const content = resolveMunicipalReportTemplate(
      template("[[report:introduction]]\n$classe_seca e $inexistente"), report, [],
    );
    expect(content.sections[0].resolvedText).toBeNull();
    expect(content.sections[0].errors).toEqual([
      "Variável sem valor: $classe_seca",
      "Variável desconhecida: $inexistente",
    ]);
  });

  it("ignores sections from analyses that were not selected", () => {
    const content = resolveMunicipalReportTemplate(
      template("[[analysis:seca:situation]]\nSeca\n[[analysis:aridez:situation]]\nAridez"), report, ["seca"],
    );
    expect(content.sections.map(({ key }) => key)).toEqual(["analysis:seca:situation"]);
  });

  it("reports malformed markers and exposes a typed variable catalog", () => {
    expect(parseMunicipalReportTemplate(template("[[wrong]]\nTexto")).errors).toContain("Marcador inválido: [[wrong]]");
    expect(buildMunicipalReportVariableCatalog(report.templateVariables)).toContainEqual({
      name: "percentual_seca", type: "percentage", description: "Variável do relatório municipal: percentual_seca.", example: 52,
    });
  });
});
