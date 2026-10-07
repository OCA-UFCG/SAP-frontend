import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CATALOG_REPORT_VARIABLES,
  DEFAULT_CATALOG_REPORT_METHODOLOGY,
  DEFAULT_CATALOG_REPORT_SECTIONS,
} from "@/config/indexCatalogReportText";
import { parsePublishedPanelLayerReportConfig } from "@/contracts/panelLayerReport";
import { populateDocContent } from "@/services/buildDoc/buildDocContent";

const THEME = "indice-de-aridez-catalogo";

/** Os valores que o relatório entrega para cada variável oferecida na tela. */
const TEMPLATE_DATA = {
  territorio: "Campina Grande — PB",
  recorte: "município",
  no_territorio: "No município de Campina Grande — PB",
  do_territorio: "do município de Campina Grande — PB",
  municipio_uf: "Campina Grande — PB",
  municipio: "Campina Grande",
  uf: "PB",
  periodo_referencia: "setembro de 2024",
  data_geracao: "03/09/2026",
  indice_indice_de_aridez_catalogo: "Índice de Aridez",
  classe_indice_de_aridez_catalogo: "Semiárido",
  percentual_indice_de_aridez_catalogo: 83.42,
  periodo_indice_de_aridez_catalogo: "2024-09",
  periodo_extenso_indice_de_aridez_catalogo: "setembro de 2024",
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
});
