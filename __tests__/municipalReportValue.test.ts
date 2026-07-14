import { describe, expect, it } from "vitest";
import {
  formatMunicipalReportValue,
  formatMunicipalReportValueWithUnit,
  getMunicipalReportValueLabels,
} from "@/utils/municipalReportValue";

describe("municipal report value presentation", () => {
  it("keeps percentage presentation for territorial coverage indicators", () => {
    const analysis = { valueType: "percentage" as const, unit: "%" };

    expect(formatMunicipalReportValue(42, analysis, "pt-BR")).toBe("42.0%");
    expect(getMunicipalReportValueLabels(analysis)).toMatchObject({
      cardContext: "da área analisada",
      tableValue: "Cobertura (%)",
    });
  });

  it("presents absolute indicators as localized raw totals", () => {
    const analysis = { valueType: "absolute" as const, unit: "registros" };

    expect(formatMunicipalReportValue(1234, analysis, "pt-BR")).toBe("1.234");
    expect(formatMunicipalReportValueWithUnit(1234, analysis, "pt-BR")).toBe(
      "1.234 registros",
    );
    expect(getMunicipalReportValueLabels(analysis)).toMatchObject({
      cardContext: "registros no município",
      sectionTitle: "Valores",
      tableValue: "Total (registros)",
      chartSeries: "Série temporal de valores",
    });
  });
});
