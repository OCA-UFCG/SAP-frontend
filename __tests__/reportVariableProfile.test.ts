import { describe, expect, it } from "vitest";

import {
  describeReportVariableProfile,
  resolveReportSeverity,
  severityRank,
} from "@/utils/reportVariableProfile";

const NOW = new Date("2025-06-15T00:00:00.000Z");

describe("describeReportVariableProfile", () => {
  it("lê a granularidade da forma dos períodos, sem depender da fonte estatística", () => {
    expect(
      describeReportVariableProfile({
        periods: ["2024-08", "2024-09"],
        classCount: 6,
        now: NOW,
      }).granularity,
    ).toBe("month");
    expect(
      describeReportVariableProfile({
        periods: ["2000", "2010", "2020"],
        classCount: 4,
        now: NOW,
      }).granularity,
    ).toBe("year");
  });

  it("trata como previsão a série cujo último período ainda não chegou", () => {
    const forecast = describeReportVariableProfile({
      periods: ["2025-07", "2025-08", "2025-09"],
      classCount: 5,
      now: NOW,
    });
    const historical = describeReportVariableProfile({
      periods: ["2025-04", "2025-05", "2025-06"],
      classCount: 5,
      now: NOW,
    });

    expect(forecast.nature).toBe("forecast");
    expect(historical.nature).toBe("historical");
  });

  it("reconhece o indicador de valor único pela classe solitária", () => {
    expect(
      describeReportVariableProfile({
        periods: ["2024"],
        classCount: 1,
        now: NOW,
      }).shape,
    ).toBe("municipal-value");
  });

  it("descarta uma ordem de gravidade com menos de duas classes", () => {
    const profile = describeReportVariableProfile({
      periods: ["2023", "2024"],
      classCount: 3,
      severity: { order: ["unica"] },
      now: NOW,
    });

    expect(profile.severity).toBeUndefined();
  });

  it("conta os períodos independentemente da ordem em que chegam", () => {
    const profile = describeReportVariableProfile({
      periods: ["2024-03", "2024-01", "2024-02"],
      classCount: 3,
      now: NOW,
    });

    expect(profile.periodCount).toBe(3);
    expect(profile.nature).toBe("historical");
  });
});

describe("resolveReportSeverity", () => {
  it("prefere a ordem declarada no catálogo", () => {
    const severity = resolveReportSeverity(
      { order: ["a", "b", "c"], neutralClassId: "a" },
      { z: { rank: 0, isNeutral: true }, y: { rank: 1 } },
    );

    expect(severity).toEqual({ order: ["a", "b", "c"], neutralClassId: "a" });
  });

  it("cai para os rankings estáticos do registro legado", () => {
    const severity = resolveReportSeverity(null, {
      "seca-moderada": { rank: 2 },
      "sem-seca": { rank: 0, isNeutral: true },
      "seca-fraca": { rank: 1 },
    });

    expect(severity).toEqual({
      order: ["sem-seca", "seca-fraca", "seca-moderada"],
      neutralClassId: "sem-seca",
    });
  });

  it("não inventa ordem quando o registro estático não tem rankings", () => {
    expect(
      resolveReportSeverity(null, {
        conservado: { description: "Sem degradação" },
      }),
    ).toBeUndefined();
    expect(resolveReportSeverity(null)).toBeUndefined();
  });
});

describe("severityRank", () => {
  it("devolve -1 para a classe fora da ordem declarada", () => {
    const severity = { order: ["umido", "arido"] };

    expect(severityRank(severity, "arido")).toBe(1);
    expect(severityRank(severity, "desconhecida")).toBe(-1);
    expect(severityRank(undefined, "arido")).toBe(-1);
  });
});
