import { describe, expect, it } from "vitest";

import { createServerTiming } from "@/utils/serverTiming";

/** O que o runtime faz com o valor: é aqui que um byte inválido estoura. */
function acceptedByResponse(header: string) {
  try {
    new Response("", { headers: { "Server-Timing": header } });
    return true;
  } catch {
    return false;
  }
}

function descriptionOf(header: string, metricName: string) {
  return header
    .split(", ")
    .find((metric) => metric.startsWith(`${metricName};`))
    ?.match(/desc="([^"]*)"/u)?.[1];
}

describe("createServerTiming", () => {
  it("mede e nomeia a métrica", () => {
    const timing = createServerTiming();
    timing.record("analysis_seca", 12.34, "Monitor de Secas");
    const header = timing.header();

    expect(header).toContain("analysis_seca;dur=12.3");
    expect(descriptionOf(header, "analysis_seca")).toBe("Monitor de Secas");
    expect(header).toContain("total;dur=");
  });

  // Regressão: um índice publicado pelo catálogo com travessão no nome fazia
  // `NextResponse.json` lançar `Cannot convert argument to a ByteString` e as
  // três rotas do Relatório Automático respondiam 502 para todos os municípios.
  it("aceita um travessão no nome da camada sem quebrar o cabeçalho", () => {
    const timing = createServerTiming();
    timing.record("analysis_teste", 1, "Previsão: Anomalia — CPTEC INPE");
    const header = timing.header();

    expect(acceptedByResponse(header)).toBe(true);
    expect(descriptionOf(header, "analysis_teste")).toBe(
      "Previsao: Anomalia CPTEC INPE",
    );
  });

  it.each([
    ["emoji", "Índice 🌵 da Caatinga"],
    ["aspas curvas", "Índice “composto” de seca"],
    ["reticências", "Cobertura da Terra…"],
    ["ideogramas", "指数 de teste"],
    ["caractere de controle", "Índice\u0007de teste"],
    ["aspas e barra", 'Índice "teste" \\ 2026'],
    ["quebra de linha", "Índice\r\nde teste"],
  ])("mantém o cabeçalho transportável com %s", (_caso, description) => {
    const timing = createServerTiming();
    timing.record("analysis_teste", 1, description);
    const header = timing.header();

    expect(acceptedByResponse(header)).toBe(true);
    expect(descriptionOf(header, "analysis_teste")).toMatch(/^[\x20-\x7e]*$/u);
  });

  it("descarta a descrição que sobra vazia depois da limpeza", () => {
    const timing = createServerTiming();
    timing.record("analysis_teste", 1, "—");

    expect(timing.header()).toContain("analysis_teste;dur=1.0,");
  });

  it("normaliza o nome da métrica para o formato do cabeçalho", () => {
    const timing = createServerTiming();
    timing.record("análise: CDI/2024", 1);

    expect(timing.header()).toContain("an_lise__CDI_2024;dur=1.0");
  });

  it("mede o tempo do trecho com start()", () => {
    const timing = createServerTiming();
    const finish = timing.start();
    finish("auth", "Autenticação");
    const header = timing.header(false);

    expect(descriptionOf(header, "auth")).toBe("Autenticacao");
    expect(header).not.toContain("total;dur=");
  });
});
