import { describe, expect, it } from "vitest";
import {
  REPORT_LIST_LIMIT,
  buildAnalysisParameters,
  buildAnalysisReportModel,
} from "@/components/Amfe/analysisReportModel";
import type { AnalyzePayload, Cities, ExcludedCities } from "@/utils/amfeInterfaces";

/** Identidade: o teste checa a estrutura, não a tradução. */
const t = (key: string) => key;

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

describe("buildAnalysisParameters", () => {
  it("abre pelos critérios, cada um com sua direção", () => {
    const parameters = buildAnalysisParameters(payload, t);

    expect(parameters[0]).toEqual({
      section: "criterios",
      label: "ips",
      value: 0.6,
      note: "beneficio",
    });
    expect(parameters[1]).toMatchObject({
      section: "",
      label: "ivcm",
      note: "custo",
    });
  });

  it("descreve os três limiares, o cenário, o ranking, a área e o modelo", () => {
    const labels = buildAnalysisParameters(payload, t).map((p) => p.label);

    expect(labels).toEqual([
      "ips",
      "ivcm",
      "indiferenca",
      "preferencia",
      "veto",
      "tipo",
      "nivel",
      "interestAreaValue",
      "versao",
    ]);
  });

  it("nomeia o cenário pessimista como tal", () => {
    const parameters = buildAnalysisParameters(
      { ...payload, typeScenario: "pessimistic" },
      t,
    );

    expect(parameters.find((p) => p.label === "tipo")?.value).toBe(
      "pessimista",
    );
  });
});

const GENERATED_AT = new Date("2026-09-17T12:00:00Z");

const CRITERIA_LABELS: Record<string, string> = { ips: "Índice de Progresso Social" };

const citiesAtLevel = (level: number, count: number): Cities =>
  Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `${level}${index}`.padStart(7, "9"),
      { name: `Cidade ${level}-${index}`, UF: "PB", classification: level },
    ]),
  );

describe("buildAnalysisReportModel", () => {
  const model = (cities: Cities, excluded: ExcludedCities = {}) =>
    buildAnalysisReportModel(
      cities,
      { count: 4, totalCount: 6, excludedCount: 2 },
      excluded,
      payload,
      t,
      CRITERIA_LABELS,
      GENERATED_AT,
    );

  it("cobre as cinco classes e fecha em 100%", () => {
    const { distribution } = model({
      ...citiesAtLevel(0, 1),
      ...citiesAtLevel(4, 3),
    });

    expect(distribution).toHaveLength(5);
    expect(distribution.map((c) => c.count)).toEqual([1, 0, 0, 0, 3]);
    expect(distribution[4].share).toBeCloseTo(75);
    expect(distribution.reduce((sum, c) => sum + c.share, 0)).toBeCloseTo(100);
  });

  it("dá a cada classe a cor que o mapa usa", () => {
    const { distribution } = model(citiesAtLevel(4, 1));

    expect(distribution[0].color).toBe("#00FF00");
    expect(distribution[4].color).toBe("#FF0000");
    expect(distribution[4].label).toBe("priorityVeryHigh");
  });

  it("lista a prioridade muito alta e conta o que sobrou do corte", () => {
    const { topPriority } = model(citiesAtLevel(4, REPORT_LIST_LIMIT + 12));

    expect(topPriority.total).toBe(REPORT_LIST_LIMIT + 12);
    expect(topPriority.shown).toHaveLength(REPORT_LIST_LIMIT);
    expect(topPriority.remaining).toBe(12);
    expect(topPriority.shown[0]).toMatchObject({ uf: "PB" });
  });

  it("não corta uma lista que cabe inteira", () => {
    const { topPriority } = model(citiesAtLevel(4, 3));

    expect(topPriority.shown).toHaveLength(3);
    expect(topPriority.remaining).toBe(0);
  });

  it("guarda os excluídos com os campos que faltaram", () => {
    const { excluded } = model(citiesAtLevel(4, 1), {
      "2504108": { name: "Cajazeiras", missing_fields: ["ips", "ivcm"] },
    });

    expect(excluded.total).toBe(1);
    expect(excluded.shown[0]).toEqual({
      name: "Cajazeiras",
      missingFields: ["ips", "ivcm"],
    });
  });

  it("traduz a área de interesse e o nível do ranking por extenso", () => {
    const { scope } = model(citiesAtLevel(4, 1));

    expect(scope).toEqual({ area: "scopeState", value: "PB", level: "scopeState" });
  });

  it("não quebra quando o excluído chega sem missing_fields", () => {
    const { excluded } = model(citiesAtLevel(4, 1), {
      "2504108": {
        name: "Cajazeiras",
      } as unknown as ExcludedCities[string],
    });

    expect(excluded.shown[0].missingFields).toEqual([]);
  });

  it("traduz a cobertura vinda do backend", () => {
    expect(model(citiesAtLevel(4, 1)).coverage).toEqual({
      analyzed: 4,
      total: 6,
      excluded: 2,
    });
  });

  it("aceita uma análise sem cobertura", () => {
    const withoutCoverage = buildAnalysisReportModel(
      citiesAtLevel(4, 1),
      null,
      {},
      payload,
      t,
      CRITERIA_LABELS,
      GENERATED_AT,
    );

    expect(withoutCoverage.coverage).toBeNull();
    expect(withoutCoverage.distribution).toHaveLength(5);
  });

  it("ignora uma classificação fora da escala em vez de quebrar", () => {
    const { distribution, topPriority } = model({
      "2504108": { name: "Fantasma", UF: "PB", classification: 9 },
      ...citiesAtLevel(4, 2),
    });

    expect(distribution.reduce((sum, c) => sum + c.count, 0)).toBe(2);
    expect(topPriority.total).toBe(2);
  });

  it("usa o rótulo legível do catálogo para cada critério", () => {
    const { criteria } = model(citiesAtLevel(4, 1));

    expect(criteria[0]).toEqual({
      label: "Índice de Progresso Social",
      weight: 0.6,
      direction: "beneficio",
    });
    expect(criteria[1]).toMatchObject({ weight: 0.4, direction: "custo" });
  });

  it("recai no próprio nome quando o critério não está no catálogo", () => {
    const { criteria } = model(citiesAtLevel(4, 1));

    // "ivcm" não está em CRITERIA_LABELS.
    expect(criteria[1].label).toBe("ivcm");
  });

  it("lista os três limiares e o cenário e o modelo à parte", () => {
    const { thresholds, scenario, modelVersion } = model(citiesAtLevel(4, 1));

    expect(thresholds).toEqual([
      { label: "indiferenca", value: 0.02 },
      { label: "preferencia", value: 0.1 },
      { label: "veto", value: 0.5 },
    ]);
    expect(scenario).toBe("otimista");
    expect(modelVersion).toBe("1.0");
  });

  it("nomeia o cenário pessimista como tal no modelo do relatório", () => {
    const { scenario } = buildAnalysisReportModel(
      citiesAtLevel(4, 1),
      null,
      {},
      { ...payload, typeScenario: "pessimistic" },
      t,
      CRITERIA_LABELS,
      GENERATED_AT,
    );

    expect(scenario).toBe("pessimista");
  });

  it("não expõe mais ranqueamento e área de interesse como parâmetros", () => {
    const result = model(citiesAtLevel(4, 1)) as unknown as Record<
      string,
      unknown
    >;

    expect(result.parameters).toBeUndefined();
  });
});
