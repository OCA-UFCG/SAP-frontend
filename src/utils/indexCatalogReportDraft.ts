import {
  DEFAULT_CATALOG_REPORT_METHODOLOGY,
  DEFAULT_CATALOG_REPORT_SECTIONS,
} from "@/config/indexCatalogReportText";
import {
  PANEL_LAYER_REPORT_SCHEMA_VERSION,
  type PublishedPanelLayerReportConfig,
} from "@/contracts/panelLayerReport";

/**
 * O texto do relatório em edição. Vive separado de `IndexCatalogDraftInput` de
 * propósito: mudar uma frase não descreve os dados e não pode invalidar a
 * prévia já validada no Earth Engine.
 */
export interface IndexCatalogReportDraft {
  sections: Array<{ title: string; text: string }>;
  sectionColor: string;
  methodology: string;
}

/**
 * O rascunho de texto com que um índice novo começa.
 *
 * Vem preenchido, e não em branco, porque um índice do catálogo não tem seção
 * no Google Docs: em branco ele publicaria sem nenhuma narrativa. O texto
 * padrão é genérico mas publicável, e serve de exemplo vivo de onde entra
 * frase e onde entra dado.
 */
export function createDefaultReportDraft(): IndexCatalogReportDraft {
  return {
    sections: DEFAULT_CATALOG_REPORT_SECTIONS.map((section) => ({
      ...section,
    })),
    sectionColor: "",
    methodology: DEFAULT_CATALOG_REPORT_METHODOLOGY,
  };
}

/**
 * O rascunho de texto com que um índice **legado** adotado começa: vazio.
 *
 * O oposto de `createDefaultReportDraft`, e por um motivo concreto: um legado
 * já tem narrativa, num bloco do Google Docs. Abrir com o texto padrão do
 * catálogo e salvar substituiria o texto real do documento por um genérico.
 * Vazio significa "continua vindo do documento", e é da rota de importação que
 * o texto de verdade vem quando o operador quiser editá-lo aqui.
 */
export function createEmptyReportDraft(): IndexCatalogReportDraft {
  return { sections: [], sectionColor: "", methodology: "" };
}

/**
 * O texto do rascunho no formato que a rota de gravação recebe.
 *
 * Aplica as mesmas regras do contrato — descarta a seção sem texto e apara os
 * espaços — para que o resultado possa ser comparado com o que já está gravado
 * sem falso positivo de diferença.
 *
 * @example
 * toReportTextPayload({ sections: [{ title: "Situação atual", text: " a " }], sectionColor: "", methodology: "" });
 * // { schemaVersion: 1, sections: [{ title: "Situação atual", text: "a" }] }
 */
export function toReportTextPayload(
  draft: IndexCatalogReportDraft,
): PublishedPanelLayerReportConfig {
  return {
    schemaVersion: PANEL_LAYER_REPORT_SCHEMA_VERSION,
    ...(draft.sectionColor ? { sectionColor: draft.sectionColor } : {}),
    ...(draft.methodology.trim()
      ? { methodology: draft.methodology.trim() }
      : {}),
    sections: draft.sections
      .filter((section) => section.text.trim())
      .map((section) => ({
        title: section.title.trim(),
        text: section.text.trim(),
      })),
  };
}

/**
 * Se o texto em edição já é o que está gravado no índice.
 *
 * Serve para o "Salvar rascunho" não gastar uma escrita no Contentful — nem um
 * evento na trilha de auditoria — quando ninguém mexeu na narrativa.
 */
export function isStoredReportText(
  payload: PublishedPanelLayerReportConfig,
  stored: PublishedPanelLayerReportConfig | undefined,
): boolean {
  if (!stored) {
    return (
      payload.sections.length === 0 &&
      !payload.sectionColor &&
      !payload.methodology
    );
  }

  return (
    (payload.sectionColor ?? "") === (stored.sectionColor ?? "") &&
    (payload.methodology ?? "") === (stored.methodology ?? "") &&
    JSON.stringify(payload.sections) === JSON.stringify(stored.sections)
  );
}

/** O texto gravado, de volta na forma que o formulário edita. */
export function toReportDraft(
  stored: PublishedPanelLayerReportConfig | undefined,
): IndexCatalogReportDraft {
  if (!stored) return createDefaultReportDraft();

  return {
    sections: stored.sections.map((section) => ({ ...section })),
    sectionColor: stored.sectionColor ?? "",
    methodology: stored.methodology ?? "",
  };
}
