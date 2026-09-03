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
  municipio: "Campina Grande",
  uf: "PB",
  periodo_referencia: "setembro de 2024",
  data_geracao: "03/09/2026",
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
