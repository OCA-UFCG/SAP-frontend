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
      { municipio: "Campina Grande", texto_tendencia_recente_seca: "Texto do backend" },
    );

    expect(content.DROUGHT_MONITOR[0].text).toBe(
      "Texto configurado no Docs para Campina Grande.",
    );
  });

  it("does not fabricate a value for an unknown placeholder", () => {
    const content = populateDocContent(
      { ARIDITY_INDEX: [{ title: "Classificação", text: "IA = [valor_ia_medio]" }] },
      { municipio: "Campina Grande" },
    );

    expect(content.ARIDITY_INDEX[0].text).toBe("IA = [valor_ia_medio]");
  });

  it("uses the layer effective period for the current Google Docs [MÊS/ANO] placeholder", () => {
    const content = populateDocContent(
      { DROUGHT_MONITOR: [{ title: "Situação atual", text: "Monitor de Secas de [MÊS/ANO]." }] },
      { periodo_seca: "abril de 2026" },
    );

    expect(content.DROUGHT_MONITOR[0].text).toBe("Monitor de Secas de abril de 2026.");
  });
});
