import { describe, expect, it } from "vitest";
import { renderAnalysisReportHtml } from "@/components/Amfe/analysisReportHtml";
import { buildAnalysisReportModel } from "@/components/Amfe/analysisReportModel";
import type { AnalyzePayload, Cities } from "@/utils/amfeInterfaces";

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}:${Object.values(values).join("|")}` : key;

const payload: AnalyzePayload = {
  criteria: [
    { name: "ips", value: 0.25, is_benefit: true },
    { name: "ivcm", value: 0.75, is_benefit: false },
  ],
  thresholds: { indifference: 0.02, preference: 0.1, veto: 0.5 },
  model: { version: "1.0" },
  typeScenario: "pessimistic",
  ranking: { level: "state" },
  interestArea: { type: "state", value: "PB" },
};

const CRITERIA_LABELS = { ips: "Índice de Progresso Social" };

const MAP_PNG = "data:image/png;base64,AAAA";

const render = (
  cities: Cities,
  excluded = {},
  criteriaLabels = CRITERIA_LABELS,
  locale = "pt",
) =>
  renderAnalysisReportHtml(
    buildAnalysisReportModel(
      cities,
      { count: 1, totalCount: 2, excludedCount: 1 },
      excluded,
      payload,
      t,
      criteriaLabels,
      new Date("2026-09-17T12:00:00Z"),
    ),
    MAP_PNG,
    t,
    locale,
  );

describe("renderAnalysisReportHtml", () => {
  it("escapa o que veio do backend", () => {
    const html = render({
      "1": { name: "Foo <b>bar</b>", UF: "PB", classification: 4 },
    });

    expect(html).not.toContain("<b>bar</b>");
    expect(html).toContain("Foo &lt;b&gt;bar&lt;/b&gt;");
  });

  it("embute o mapa recebido", () => {
    expect(
      render({ "1": { name: "Areia", UF: "PB", classification: 4 } }),
    ).toContain(`src="${MAP_PNG}"`);
  });

  it("desenha a área de interesse e o nível do ranking por extenso no cabeçalho", () => {
    const html = render({ "1": { name: "Areia", UF: "PB", classification: 4 } });

    expect(html).toContain("reportScope:scopeState|PB|scopeState");
  });

  it("lista o excluído só pelo nome e escapa o nome", () => {
    const html = render(
      { "1": { name: "Areia", UF: "PB", classification: 4 } },
      { "2": { name: "Foo <b>bar</b>", missing_fields: ["ips", "ivcm"] } },
    );

    expect(html).not.toContain("reportMissingFields");
    expect(html).not.toContain("ips, ivcm");
    expect(html).toContain("Foo &lt;b&gt;bar&lt;/b&gt;");
    expect(html).not.toContain("<b>bar</b>");
  });

  it("manda a página sair em A4", () => {
    expect(
      render({ "1": { name: "Areia", UF: "PB", classification: 4 } }),
    ).toContain("@page");
  });

  it("desenha a cobertura quando ela existe", () => {
    const html = render({
      "1": { name: "Areia", UF: "PB", classification: 4 },
    });

    expect(html).toContain("reportCoverage:1|2|1");
  });

  it("omite a cobertura quando o backend não a mandou", () => {
    const html = renderAnalysisReportHtml(
      buildAnalysisReportModel(
        { "1": { name: "Areia", UF: "PB", classification: 4 } },
        null,
        {},
        payload,
        t,
        new Date("2026-09-17T12:00:00Z"),
      ),
      MAP_PNG,
      t,
      "pt",
    );

    expect(html).not.toContain("reportCoverage");
  });

  it("aponta a planilha quando a lista foi cortada", () => {
    const cities: Cities = Object.fromEntries(
      Array.from({ length: 42 }, (_, index) => [
        `${index}`,
        { name: `Cidade ${index}`, UF: "PB", classification: 4 },
      ]),
    );

    const html = render(cities);

    expect(html).toContain("reportAndMore:12");
    expect(html).toContain("reportSeeWorkbook");
  });

  it("não aponta a planilha quando a lista coube inteira", () => {
    const html = render({
      "1": { name: "Areia", UF: "PB", classification: 4 },
    });

    expect(html).not.toContain("reportAndMore");
  });

  it("desenha os critérios com o rótulo do catálogo e o nome cru como reserva", () => {
    const html = render({ "1": { name: "Areia", UF: "PB", classification: 4 } });

    expect(html).toContain("Índice de Progresso Social");
    // "ivcm" não está em CRITERIA_LABELS.
    expect(html).toContain(">ivcm<");
  });

  it("desenha as tabelas de critérios e limiares, cada uma com cabeçalho próprio", () => {
    const html = render({ "1": { name: "Areia", UF: "PB", classification: 4 } });

    expect(html).toContain("reportCriterionColumn");
    expect(html).toContain("reportWeightColumn");
    expect(html).toContain("reportDirectionColumn");
    expect(html).toContain("reportThresholdColumn");
    expect(html).toContain("reportValueColumn");
    expect((html.match(/<thead>/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("não mostra mais ranqueamento e área de interesse crus na seção de parâmetros", () => {
    const html = render({ "1": { name: "Areia", UF: "PB", classification: 4 } });

    // O bug original repetia o enum cru do backend ("state") na seção de
    // parâmetros, já traduzido no cabeçalho via reportScope.
    expect(html).not.toContain(">state<");
  });

  it("formata peso e limiar pelo locale, com vírgula em pt", () => {
    const html = render({ "1": { name: "Areia", UF: "PB", classification: 4 } });

    expect(html).toContain(">0,25<");
    expect(html).toContain(">0,02<");
    expect(html).not.toContain(">0.25<");
  });

  it("formata peso e limiar com ponto decimal em en", () => {
    const html = render(
      { "1": { name: "Areia", UF: "PB", classification: 4 } },
      {},
      CRITERIA_LABELS,
      "en",
    );

    expect(html).toContain("0.25");
  });

  it("mostra cenário e versão do modelo como linhas curtas, não como tabela", () => {
    const html = render({ "1": { name: "Areia", UF: "PB", classification: 4 } });

    expect(html).toContain("reportModelVersion:1.0");
  });
});
