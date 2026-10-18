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

describe("createServerTiming com muitas medições", () => {
  // Regressão: "Selecionar todos" na Comunicação pede 39 camadas; num município
  // fora do cache, cada uma virava uma medição e o cabeçalho passava de 4,5 KB.
  // O nginx da frente só aceita 4 KB de cabeçalhos e respondia 502.
  it("cabe no buffer do nginx mesmo com 39 camadas", () => {
    const timing = createServerTiming();
    for (let i = 0; i < 39; i++) {
      timing.record(
        `analysis_previsao_precipitacao_trimestral_probabilidade_${i}`,
        100 + i,
        `Previsão de precipitação trimestral (probabilidade) ${i}`,
      );
    }
    const header = timing.header();

    expect(header.length).toBeLessThanOrEqual(2048);
    expect(header).toContain("total;dur=");
    expect(header).toMatch(/omitted;dur=0\.0;desc="\d+ medicoes omitidas/u);
    // As mais lentas ficam: são elas que explicam a demora.
    expect(header).toContain("_38;dur=138.0");
    expect(header).not.toContain("_0;dur=100.0");
  });

  it("não mexe no cabeçalho quando tudo cabe", () => {
    const timing = createServerTiming();
    timing.record("auth", 1);
    timing.record("analysis_seca", 2, "Monitor de Secas");

    expect(timing.header()).toMatch(
      /^auth;dur=1\.0, analysis_seca;dur=2\.0;desc="Monitor de Secas", total;dur=/u,
    );
  });
});
