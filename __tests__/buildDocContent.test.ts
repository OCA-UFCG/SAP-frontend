import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { populateDocContent } from "@/services/buildDoc/buildDocContent";

describe("populateDocContent", () => {
  it("preserves the editable Docs text while interpolating only real template data", () => {
    const content = populateDocContent(
      {
        DROUGHT_MONITOR: [
          {
            title: "Tendência recente",
            text: "Texto configurado no Docs para [municipio].",
          },
        ],
      },
      {
        municipio: "Campina Grande",
        texto_tendencia_recente_seca: "Texto do backend",
      },
    );

    expect(content.DROUGHT_MONITOR[0].text).toBe(
      "Texto configurado no Docs para Campina Grande.",
    );
  });

  it("does not fabricate a value for an unknown placeholder", () => {
    const content = populateDocContent(
      {
        ARIDITY_INDEX: [
          { title: "Classificação", text: "IA = [valor_ia_medio]" },
        ],
      },
      { municipio: "Campina Grande" },
    );

    expect(content.ARIDITY_INDEX[0].text).toBe("IA = [valor_ia_medio]");
  });

  it("uses the layer effective period for the current Google Docs [MÊS/ANO] placeholder", () => {
    const content = populateDocContent(
      {
        DROUGHT_MONITOR: [
          { title: "Situação atual", text: "Monitor de Secas de [MÊS/ANO]." },
        ],
      },
      { periodo_seca: "abril de 2026" },
    );

    expect(content.DROUGHT_MONITOR[0].text).toBe(
      "Monitor de Secas de abril de 2026.",
    );
  });

  it("populates report-wide sections with report template data", () => {
    const content = populateDocContent(
      { __report__: [{ title: "Rodapé", text: "Gerado em [data_geracao]." }] },
      { data_geracao: "13/07/2026" },
    );

    expect(content.__report__[0].text).toBe("Gerado em 13/07/2026.");
  });

  it("formats direct and aliased percentage placeholders in pt-BR", () => {
    const content = populateDocContent(
      {
        DROUGHT_MONITOR: [
          {
            title: "Situação atual",
            text: "Direto: [percentual_seca]%; alias: [PERCENTUAL]%.",
          },
        ],
      },
      { percentual_seca: 42.5 },
    );

    expect(content.DROUGHT_MONITOR[0].text).toBe(
      "Direto: 42,5%; alias: 42,5%.",
    );
  });

  it("formats sequential degradation percentage aliases with the right precision", () => {
    const content = populateDocContent(
      {
        DEGRADATION_INDEX: [
          {
            title: "Valores",
            text: "Soma: [X]%; conservado: [X]%; nível 1: [X]%.",
          },
        ],
      },
      {
        soma_percentual_deg_n3_n4_n5: 12.345,
        percentual_deg_conservado: 42.5,
        percentual_deg_n1: 18.75,
      },
    );

    expect(content.DEGRADATION_INDEX[0].text).toBe(
      "Soma: 12,35%; conservado: 42,5%; nível 1: 18,8%.",
    );
  });
});
