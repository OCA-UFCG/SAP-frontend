import { describe, expect, it } from "vitest";
import {
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
    expect(distribution.map((c) => c.count)).toEqual([3, 0, 0, 0, 1]);
    expect(distribution[0].share).toBeCloseTo(75);
    expect(distribution.reduce((sum, c) => sum + c.share, 0)).toBeCloseTo(100);
  });

  it("dá a cada classe a cor que o mapa usa, da maior prioridade para a menor", () => {
    const { distribution } = model(citiesAtLevel(4, 1));

    expect(distribution[0].color).toBe("#FF0000");
    expect(distribution[0].label).toBe("priorityVeryHigh");
    expect(distribution[4].color).toBe("#0094FF");
  });

  it("lista todos os municípios de cada classe, sem corte", () => {
    const { classLists } = model({
      ...citiesAtLevel(4, 42),
      ...citiesAtLevel(1, 2),
    });

    expect(classLists.map((c) => c.level)).toEqual([4, 3, 2, 1, 0]);
    expect(classLists[0].cities).toHaveLength(42);
    expect(classLists[3].cities).toEqual(["Cidade 1-0", "Cidade 1-1"]);
    expect(classLists[4].cities).toEqual([]);
  });

  it("põe a sigla do estado só quando o ranking mistura estados", () => {
    const { classLists } = model({
      "1": { name: "Santa Luzia", UF: "PB", classification: 4 },
      "2": { name: "Santa Luzia", UF: "MG", classification: 4 },
    });

    expect(classLists[0].cities).toEqual([
      "Santa Luzia – MG",
      "Santa Luzia – PB",
    ]);
    expect(model(citiesAtLevel(4, 1)).classLists[0].cities).toEqual([
      "Cidade 4-0",
    ]);
  });

  it("guarda os excluídos apenas pelo nome", () => {
    const { excluded } = model(citiesAtLevel(4, 1), {
      "2504108": { name: "Cajazeiras", missing_fields: ["ips", "ivcm"] },
    });

    expect(excluded).toEqual(["Cajazeiras"]);
  });

  it("escreve o estado por extenso com a sigla, como no cabeçalho do relatório", () => {
    const { scope } = model(citiesAtLevel(4, 1));

    expect(scope).toEqual({ place: "Paraíba, PB", level: "scopeState" });
  });

  it("nomeia o lugar das demais áreas de interesse", () => {
    const placeOf = (interestArea: AnalyzePayload["interestArea"]) =>
      buildAnalysisReportModel(
        {},
        null,
        {},
        { ...payload, interestArea },
        t,
        CRITERIA_LABELS,
        GENERATED_AT,
      ).scope.place;

    expect(placeOf({ type: "national", value: "brasil" })).toBe(
      "reportPlaceNational",
    );
    expect(placeOf({ type: "region", value: "Nordeste" })).toBe("Nordeste");
    expect(placeOf({ type: "biome", value: "Caatinga" })).toBe("Caatinga");
    expect(placeOf({ type: "semiarid", value: "semiarid" })).toBe(
      "scopeSemiarid",
    );
    expect(placeOf({ type: "asd", value: "asd" })).toBe("scopeAsd");
  });

  it("não quebra quando o excluído chega sem nome", () => {
    const { excluded } = model(citiesAtLevel(4, 1), {
      "2504108": {} as unknown as ExcludedCities[string],
    });

    expect(excluded).toEqual([""]);
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
    const { distribution, classLists } = model({
      "2504108": { name: "Fantasma", UF: "PB", classification: 9 },
      ...citiesAtLevel(4, 2),
    });

    expect(distribution.reduce((sum, c) => sum + c.count, 0)).toBe(2);
    expect(classLists.flatMap((c) => c.cities)).toHaveLength(2);
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

  it("lista os três limiares com descrição e o cenário e o modelo à parte", () => {
    const { thresholds, classCount, scenario, modelVersion } = model(
      citiesAtLevel(4, 1),
    );

    expect(thresholds).toEqual([
      {
        label: "indiferenca",
        value: 0.02,
        description: "reportIndifferenceDescription",
      },
      {
        label: "preferencia",
        value: 0.1,
        description: "reportPreferenceDescription",
      },
      { label: "veto", value: 0.5, description: "reportVetoDescription" },
    ]);
    expect(classCount).toBe(5);
    expect(scenario).toEqual({
      label: "otimista",
      note: "reportScenarioOptimisticNote",
    });
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

    expect(scenario).toEqual({
      label: "pessimista",
      note: "reportScenarioPessimisticNote",
    });
  });

  it("não expõe mais ranqueamento e área de interesse como parâmetros", () => {
    const result = model(citiesAtLevel(4, 1)) as unknown as Record<
      string,
      unknown
    >;

    expect(result.parameters).toBeUndefined();
  });
});
