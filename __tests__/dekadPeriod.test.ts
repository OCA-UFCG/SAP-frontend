import { describe, expect, it } from "vitest";

import { formatDekadPeriod, parseDekadPeriod } from "@/utils/dekadPeriod";
import { assertGeeStatisticsPeriod } from "@/contracts/geeStatisticsAsset";
import { formatReportPeriod } from "@/utils/municipalReportNarrative";
import { inferTimeScale } from "@/utils/indexCatalog";
import { resolveNearestReportPeriod } from "@/utils/municipalAvailability";

describe("dekad periods", () => {
  it("reads the dekad order from the first day", () => {
    expect(parseDekadPeriod("2001-01-01")?.dekad).toBe(1);
    expect(parseDekadPeriod("2001-01-11")?.dekad).toBe(2);
    expect(parseDekadPeriod("2001-01-21")?.dekad).toBe(3);
    expect(parseDekadPeriod("2001-01-15")).toBeNull();
    expect(parseDekadPeriod("2001-01")).toBeNull();
  });

  it("writes the days of the dekad in each platform language", () => {
    expect(formatDekadPeriod("2026-09-01", "pt-BR")).toBe(
      "1 a 10 de setembro de 2026",
    );
    expect(formatDekadPeriod("2026-09-11", "en")).toBe("September 11–20, 2026");
    expect(formatDekadPeriod("2026-09-21", "es")).toBe(
      "21 al 30 de septiembre de 2026",
    );
  });

  // O terceiro decêndio vai até o fim do mês, que muda de tamanho.
  it("ends the third dekad on the last day of the month", () => {
    expect(formatDekadPeriod("2024-02-21", "pt-BR")).toBe(
      "21 a 29 de fevereiro de 2024",
    );
    expect(formatDekadPeriod("2026-01-21", "pt-BR")).toBe(
      "21 a 31 de janeiro de 2026",
    );
  });

  it("names the dekad in the report text instead of the raw key", () => {
    expect(formatReportPeriod("2026-09-21", "pt-BR")).toBe(
      "21 a 30 de setembro de 2026",
    );
  });

  it("accepts only dekad keys for a dekad source", () => {
    expect(() =>
      assertGeeStatisticsPeriod("2001-01-11", "dekad"),
    ).not.toThrow();
    expect(() => assertGeeStatisticsPeriod("2001-01", "dekad")).toThrow();
    expect(() => assertGeeStatisticsPeriod("2001-01-15", "dekad")).toThrow();
  });

  it("labels the time scale as Decendial", () => {
    expect(inferTimeScale(["2001-01-01", "2001-01-11"])).toBe("Decendial");
  });

  // O relatório da Comunicação pede o ano ("2026") e usa o período mais recente
  // dele; sem aceitar a chave de decêndio, o índice nunca entrava no relatório.
  it("resolves a requested year to its latest dekad in the report", () => {
    expect(
      resolveNearestReportPeriod(
        ["2025-12-21", "2026-09-01", "2026-09-11"],
        "2026",
      ),
    ).toBe("2026-09-11");
  });
});
