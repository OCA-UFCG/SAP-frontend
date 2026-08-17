import { describe, expect, it } from "vitest";
import {
  formatPercentage,
  formatMunicipalReportValue,
  formatMunicipalReportValueWithUnit,
  getMunicipalReportValueLabels,
} from "@/utils/municipalReportValue";

describe("municipal report value presentation", () => {
  it("keeps percentage presentation for territorial coverage indicators", () => {
    const analysis = { valueType: "percentage" as const, unit: "%" };

    expect(formatMunicipalReportValue(42, analysis, "pt-BR")).toBe("42,0%");
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

describe("formatPercentage", () => {
  it("formats with pt-BR locale (comma decimal, dot thousands separator)", () => {
    expect(formatPercentage(1234.5, "pt-BR")).toBe("1.234,5");
    expect(formatPercentage(1234.5, "pt-BR", 2)).toBe("1.234,50");
    expect(formatPercentage(42, "pt-BR")).toBe("42,0");
    expect(formatPercentage(0.5, "pt-BR")).toBe("0,5");
  });

  it("formats with en-US locale (dot decimal, comma thousands separator)", () => {
    expect(formatPercentage(1234.5, "en-US")).toBe("1,234.5");
    expect(formatPercentage(1234.5, "en-US", 2)).toBe("1,234.50");
    expect(formatPercentage(42, "en-US")).toBe("42.0");
    expect(formatPercentage(0.5, "en-US")).toBe("0.5");
  });

  it("formats with es-AR locale (comma decimal, dot thousands separator)", () => {
    expect(formatPercentage(1234.5, "es-AR")).toBe("1.234,5");
    expect(formatPercentage(1234.5, "es-AR", 2)).toBe("1.234,50");
    expect(formatPercentage(42, "es-AR")).toBe("42,0");
    expect(formatPercentage(0.5, "es-AR")).toBe("0,5");
  });

  it("supports the locale identifiers used by the application routes", () => {
    expect(formatPercentage(42.5, "pt")).toBe("42,5");
    expect(formatPercentage(42.5, "en")).toBe("42.5");
    expect(formatPercentage(42.5, "es")).toBe("42,5");
  });
});
