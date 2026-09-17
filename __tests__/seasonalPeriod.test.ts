import { describe, expect, it } from "vitest";
import {
  formatSeasonalPeriodLabel,
  hasSeasonalPeriods,
  resolveSeasonEndMonthKey,
  seasonAcronymForPeriod,
  seasonPairsDescribeQuarters,
} from "@/utils/seasonalPeriod";
import type { PanelLayerI } from "@/utils/interfaces";

function buildLayer(season?: string): Pick<PanelLayerI, "statisticsSource"> {
  return {
    statisticsSource: {
      kind: "gee-feature-collection",
      schemaVersion: 1,
      sourceRevision: "a".repeat(64),
      periodGranularity: "month",
      asset: { type: "fixed", assetId: "projects/x/assets/t" },
      properties: {
        level: "NIVEL_AGRUPAMENTO",
        locationName: "NOME_LOCAL",
        municipalityCode: "CD_MUN",
        stateCode: "NM_UF",
        year: "ano",
        date: "data_img",
        totalArea: "area_total_ha",
        ...(season ? { season } : {}),
      },
    },
  } as Pick<PanelLayerI, "statisticsSource">;
}

describe("seasonalPeriod", () => {
  it("reconhece a camada sazonal pela coluna do trimestre", () => {
    expect(hasSeasonalPeriods(buildLayer("temporada"))).toBe(true);
    expect(hasSeasonalPeriods(buildLayer())).toBe(false);
    expect(hasSeasonalPeriods(undefined)).toBe(false);
  });

  it("escreve os três meses do trimestre que começa no período", () => {
    expect(formatSeasonalPeriodLabel("2026-09")).toBe(
      "Setembro - Outubro - Novembro - 2026",
    );
    expect(formatSeasonalPeriodLabel("2026-10")).toBe(
      "Outubro - Novembro - Dezembro - 2026",
    );
  });

  it("atravessa a virada do ano como o asset do GEE (NDJ, DJF)", () => {
    expect(formatSeasonalPeriodLabel("2026-11")).toBe(
      "Novembro - Dezembro - Janeiro - 2026",
    );
    expect(resolveSeasonEndMonthKey("2026-11")).toBe("2027-01");
    expect(resolveSeasonEndMonthKey("2026-12")).toBe("2027-02");
  });

  it("ignora chaves que não são um mês", () => {
    expect(formatSeasonalPeriodLabel("2026")).toBeNull();
    expect(formatSeasonalPeriodLabel("general")).toBeNull();
    expect(resolveSeasonEndMonthKey("2026-13")).toBeNull();
  });

  it("monta a sigla que o asset trimestral usa no período", () => {
    expect(seasonAcronymForPeriod("2026-09")).toBe("SON");
    expect(seasonAcronymForPeriod("2026-10")).toBe("OND");
    expect(seasonAcronymForPeriod("2026-11")).toBe("NDJ");
    expect(seasonAcronymForPeriod("2026-12")).toBe("DJF");
    expect(seasonAcronymForPeriod("2026")).toBeNull();
  });

  it("separa a previsão trimestral da mensal pelos pares período/sigla", () => {
    // Pares medidos nos assets em produção (setembro de 2026).
    expect(
      seasonPairsDescribeQuarters([
        ["2026-09", "SON"],
        ["2026-10", "OND"],
      ]),
    ).toBe(true);
    // INMET mensal: a sigla é a da emissão e se repete em todos os meses.
    expect(
      seasonPairsDescribeQuarters([
        ["2026-10", "OND"],
        ["2026-11", "OND"],
        ["2026-12", "OND"],
      ]),
    ).toBe(false);
    expect(seasonPairsDescribeQuarters([])).toBe(false);
  });
});