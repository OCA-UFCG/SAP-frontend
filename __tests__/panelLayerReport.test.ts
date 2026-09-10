import { describe, expect, it } from "vitest";

import {
  parsePublishedPanelLayerReportConfig,
  tryParsePublishedPanelLayerReportConfig,
} from "@/contracts/panelLayerReport";

const valid = {
  schemaVersion: 1,
  sectionColor: "#795548",
  methodology: "Razão entre precipitação e evapotranspiração potencial.",
  sections: [
    { title: "Situação atual", text: "O município está em [classe_aridez]." },
    { title: "Histórico recente", text: "Desde [periodo_aridez]." },
  ],
};

describe("parsePublishedPanelLayerReportConfig", () => {
  it("aceita a configuração completa e apara os espaços", () => {
    const parsed = parsePublishedPanelLayerReportConfig({
      ...valid,
      methodology: "  Razão entre precipitação.  ",
      sections: [{ title: "  Situação atual  ", text: "  Texto.  " }],
    });

    expect(parsed.methodology).toBe("Razão entre precipitação.");
    expect(parsed.sections).toEqual([
      { title: "Situação atual", text: "Texto." },
    ]);
  });

  it("aceita configuração só com seções", () => {
    const parsed = parsePublishedPanelLayerReportConfig({
      schemaVersion: 1,
      sections: [{ title: "Situação atual", text: "Texto." }],
    });

    expect(parsed.sectionColor).toBeUndefined();
    expect(parsed.methodology).toBeUndefined();
  });

  // Uma seção em branco some, como já acontece com um bloco vazio no Docs.
  it("descarta seção sem texto em vez de renderizar um bloco vazio", () => {
    const parsed = parsePublishedPanelLayerReportConfig({
      schemaVersion: 1,
      sections: [
        { title: "Situação atual", text: "Texto." },
        { title: "Rascunho", text: "   " },
      ],
    });

    expect(parsed.sections).toHaveLength(1);
  });

  it("rejeita schemaVersion não suportada nomeando o valor recebido", () => {
    expect(() =>
      parsePublishedPanelLayerReportConfig({ ...valid, schemaVersion: 2 }),
    ).toThrow(/schemaVersion não suportada: 2/u);
  });

  it("rejeita cor que não é hexadecimal #RRGGBB", () => {
    expect(() =>
      parsePublishedPanelLayerReportConfig({ ...valid, sectionColor: "verde" }),
    ).toThrow(/sectionColor/u);
  });

  it("rejeita seção sem título", () => {
    expect(() =>
      parsePublishedPanelLayerReportConfig({
        schemaVersion: 1,
        sections: [{ text: "Texto." }],
      }),
    ).toThrow(/precisa de um título/u);
  });

  it("rejeita texto acima do limite nomeando o tamanho", () => {
    expect(() =>
      parsePublishedPanelLayerReportConfig({
        schemaVersion: 1,
        sections: [{ title: "Situação atual", text: "x".repeat(4001) }],
      }),
    ).toThrow(/excede 4000 caracteres: 4001/u);
  });
});

describe("tryParsePublishedPanelLayerReportConfig", () => {
  // O relatório inteiro não pode cair por causa do texto de um índice.
  it("devolve null para payload malformado em vez de lançar", () => {
    expect(tryParsePublishedPanelLayerReportConfig({ schemaVersion: 9 })).toBeNull();
    expect(tryParsePublishedPanelLayerReportConfig("texto")).toBeNull();
    expect(tryParsePublishedPanelLayerReportConfig(null)).toBeNull();
  });

  it("devolve a configuração quando o payload é válido", () => {
    expect(tryParsePublishedPanelLayerReportConfig(valid)?.sections).toHaveLength(2);
  });
});

describe("parsePublishedPanelLayerReportConfig > severity", () => {
  it("aceita a ordem de gravidade com a classe neutra", () => {
    const parsed = parsePublishedPanelLayerReportConfig({
      ...valid,
      severity: {
        order: [" sem-seca ", "seca-fraca"],
        neutralClassId: "sem-seca",
      },
    });

    expect(parsed.severity).toEqual({
      order: ["sem-seca", "seca-fraca"],
      neutralClassId: "sem-seca",
    });
  });

  it("descarta uma ordem que não ordena nada", () => {
    expect(
      parsePublishedPanelLayerReportConfig({
        ...valid,
        severity: { order: ["unica"] },
      }).severity,
    ).toBeUndefined();
    expect(
      parsePublishedPanelLayerReportConfig({ ...valid, severity: null })
        .severity,
    ).toBeUndefined();
  });

  it("recusa uma classe neutra que não está na ordem", () => {
    expect(() =>
      parsePublishedPanelLayerReportConfig({
        ...valid,
        severity: { order: ["a", "b"], neutralClassId: "c" },
      }),
    ).toThrow(/neutralClassId ausente de severity.order: c/u);
  });

  it("recusa ids repetidos, que descreveriam a mesma classe em dois lugares", () => {
    expect(() =>
      parsePublishedPanelLayerReportConfig({
        ...valid,
        severity: { order: ["a", "a"] },
      }),
    ).toThrow(/repete ids de classe/u);
  });

  it("recusa uma ordem que não é lista de ids", () => {
    expect(() =>
      parsePublishedPanelLayerReportConfig({
        ...valid,
        severity: { order: "a,b" },
      }),
    ).toThrow(/severity.order deve ser uma lista/u);
    expect(() =>
      parsePublishedPanelLayerReportConfig({
        ...valid,
        severity: { order: ["a", 2] },
      }),
    ).toThrow(/severity.order\[1\]/u);
  });
});
