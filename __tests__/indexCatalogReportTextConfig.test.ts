import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CATALOG_REPORT_VARIABLES,
  DEFAULT_CATALOG_REPORT_METHODOLOGY,
  DEFAULT_CATALOG_REPORT_SECTIONS,
  DEFAULT_VALUE_INDEX_REPORT_SECTIONS,
} from "@/config/indexCatalogReportText";
import { parsePublishedPanelLayerReportConfig } from "@/contracts/panelLayerReport";
import { populateDocContent } from "@/services/buildDoc/buildDocContent";
import {
  createDefaultReportDraft,
  isUntouchedDefaultReportText,
} from "@/utils/indexCatalogReportDraft";

const THEME = "indice-de-aridez-catalogo";

/** Os valores que o relatório entrega para cada variável oferecida na tela. */
const TEMPLATE_DATA = {
  municipio: "Campina Grande",
  uf: "PB",
  periodo_referencia: "setembro de 2024",
  data_geracao: "03/09/2026",
  indice_indice_de_aridez_catalogo: "Índice de Aridez",
  classe_indice_de_aridez_catalogo: "Semiárido",
  percentual_indice_de_aridez_catalogo: 83.42,
  periodo_indice_de_aridez_catalogo: "2024-09",
  periodo_extenso_indice_de_aridez_catalogo: "setembro de 2024",
  valor_indice_de_aridez_catalogo: 83.42,
  unidade_indice_de_aridez_catalogo: "%",
  valor_com_unidade_indice_de_aridez_catalogo: "83,4 %",
};

describe("texto padrão do Relatório Automático no catálogo", () => {
  it("passa pelo contrato que a rota de gravação usa", () => {
    const parsed = parsePublishedPanelLayerReportConfig({
      schemaVersion: 1,
      sections: DEFAULT_CATALOG_REPORT_SECTIONS,
      methodology: DEFAULT_CATALOG_REPORT_METHODOLOGY,
    });

    expect(parsed.sections).toHaveLength(
      DEFAULT_CATALOG_REPORT_SECTIONS.length,
    );
    expect(parsed.methodology).toBe(DEFAULT_CATALOG_REPORT_METHODOLOGY);
  });

  it("começa por 'Situação atual', que substitui a frase automática", () => {
    expect(DEFAULT_CATALOG_REPORT_SECTIONS[0]?.title).toBe("Situação atual");
  });

  it("não deixa nenhum colchete sem resolver no relatório", () => {
    const content = populateDocContent(
      { [THEME]: [...DEFAULT_CATALOG_REPORT_SECTIONS] },
      TEMPLATE_DATA,
    );

    for (const section of content[THEME]) {
      expect(section.text).not.toMatch(/[[\]]/u);
    }
  });

  // [indice] resolve para o título da própria camada, e é o que permite o
  // texto padrão citar a fonte do dado sem ser reescrito índice a índice.
  it("troca [indice] pelo nome do índice da seção", () => {
    const content = populateDocContent(
      { [THEME]: [{ title: "Situação atual", text: "conforme o [indice]" }] },
      TEMPLATE_DATA,
    );

    expect(content[THEME][0].text).toBe("conforme o Índice de Aridez");
  });

  it("oferece na tela só variáveis que o relatório sabe resolver", () => {
    const content = populateDocContent(
      {
        [THEME]: CATALOG_REPORT_VARIABLES.map((variable) => ({
          title: variable.token,
          text: variable.token,
        })),
      },
      TEMPLATE_DATA,
    );

    expect(
      content[THEME].filter((section) => section.text.includes("[")),
    ).toEqual([]);
  });

  // Regressão: o texto padrão dizia "[percentual]% do seu território está na
  // classe [classe]" para todo índice. Num índice de valor único — uma coluna
  // da planilha da análise multicritério, por exemplo — isso imprimia "86,0% do
  // seu território está na classe Domicílios com esgotamento sanitário", e numa
  // coluna de contagem imprimiria "446% do seu território".
  it("não fala em percentual de território no índice de valor único", () => {
    const texts = DEFAULT_VALUE_INDEX_REPORT_SECTIONS.map(
      (section) => section.text,
    ).join(" ");

    expect(texts).not.toContain("[percentual]");
    expect(texts).not.toContain("[classe]");
    expect(texts).toContain("[valor_com_unidade]");
  });

  it("não deixa nenhum colchete sem resolver no índice de valor único", () => {
    const content = populateDocContent(
      { [THEME]: [...DEFAULT_VALUE_INDEX_REPORT_SECTIONS] },
      TEMPLATE_DATA,
    );

    for (const section of content[THEME]) {
      expect(section.text).not.toMatch(/[[\]]/u);
    }
  });

  // `[percentual]` e `[classe]` só significam alguma coisa numa distribuição por
  // classes; `[valor]` e companhia, só num número por município.
  it("separa as variáveis de dado pela forma do índice", () => {
    const byShape = (shape: string) =>
      CATALOG_REPORT_VARIABLES.filter((variable) => variable.shape === shape)
        .map((variable) => variable.token)
        .sort();

    expect(byShape("class-distribution")).toEqual(["[classe]", "[percentual]"]);
    expect(byShape("municipal-value")).toEqual([
      "[unidade]",
      "[valor]",
      "[valor_com_unidade]",
    ]);
  });
});

// A narrativa padrão acompanha a forma do índice, mas só enquanto ninguém a
// editou: trocar a forma não pode apagar um texto escrito à mão.
describe("isUntouchedDefaultReportText", () => {
  it("reconhece as duas narrativas padrão", () => {
    expect(isUntouchedDefaultReportText(createDefaultReportDraft())).toBe(true);
    expect(
      isUntouchedDefaultReportText(createDefaultReportDraft("municipal-value")),
    ).toBe(true);
  });

  it("não reconhece um texto que o operador escreveu", () => {
    const draft = createDefaultReportDraft();
    draft.sections[0].text = "Frase escrita à mão para este índice.";

    expect(isUntouchedDefaultReportText(draft)).toBe(false);
  });
});
