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
  /**
   * Se o índice entra no Relatório Automático. Começa marcado: um índice novo
   * nasce dentro do relatório, e sair dele é uma decisão explícita de quem
   * cadastra.
   */
  includeInReport: boolean;
  sections: Array<{ title: string; text: string }>;
  sectionColor: string;
  methodology: string;
  /**
   * Ids das classes, da melhor para a pior. Vazio quando o índice não tem
   * ordem de gravidade — cobertura da terra, por exemplo —, e é esse vazio que
   * mantém as variáveis de tendência fora da lista em vez de inventar uma
   * ordem a partir da ordem da legenda.
   */
  severityOrder: string[];
  /** Id da classe que representa a condição normal, quando existe uma. */
  neutralClassId: string;
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
    includeInReport: true,
    sections: DEFAULT_CATALOG_REPORT_SECTIONS.map((section) => ({
      ...section,
    })),
    sectionColor: "",
    methodology: DEFAULT_CATALOG_REPORT_METHODOLOGY,
    severityOrder: [],
    neutralClassId: "",
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
  return {
    includeInReport: true,
    sections: [],
    sectionColor: "",
    methodology: "",
    severityOrder: [],
    neutralClassId: "",
  };
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
    ...(draft.includeInReport ? {} : { includeInReport: false }),
    ...(draft.sectionColor ? { sectionColor: draft.sectionColor } : {}),
    ...(draft.methodology.trim()
      ? { methodology: draft.methodology.trim() }
      : {}),
    ...(draft.severityOrder.length >= 2
      ? {
          severity: {
            order: [...draft.severityOrder],
            ...(draft.neutralClassId
              ? { neutralClassId: draft.neutralClassId }
              : {}),
          },
        }
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
      !payload.methodology &&
      !payload.severity &&
      payload.includeInReport !== false
    );
  }

  return (
    (payload.includeInReport !== false) ===
      (stored.includeInReport !== false) &&
    (payload.sectionColor ?? "") === (stored.sectionColor ?? "") &&
    (payload.methodology ?? "") === (stored.methodology ?? "") &&
    JSON.stringify(payload.severity ?? null) ===
      JSON.stringify(stored.severity ?? null) &&
    JSON.stringify(payload.sections) === JSON.stringify(stored.sections)
  );
}

/** O texto gravado, de volta na forma que o formulário edita. */
export function toReportDraft(
  stored: PublishedPanelLayerReportConfig | undefined,
): IndexCatalogReportDraft {
  if (!stored) return createDefaultReportDraft();

  return {
    includeInReport: stored.includeInReport !== false,
    sections: stored.sections.map((section) => ({ ...section })),
    sectionColor: stored.sectionColor ?? "",
    methodology: stored.methodology ?? "",
    severityOrder: [...(stored.severity?.order ?? [])],
    neutralClassId: stored.severity?.neutralClassId ?? "",
  };
}

export type ReportSeverityChoice =
  "none" | "best-first" | "worst-first" | "stale";

/**
 * Como a ordem de gravidade gravada se relaciona com as classes que o índice
 * tem hoje.
 *
 * `stale` é o caso que importa: quem reordenou, renomeou ou removeu uma classe
 * depois de declarar a ordem tem uma lista que já não descreve o índice. Dizer
 * isso é melhor do que reinterpretá-la em silêncio, porque a reinterpretação
 * mais provável — "a ordem da legenda é a ordem da gravidade" — é justamente o
 * palpite que esta declaração existe para evitar.
 *
 * @example
 * describeSeverityChoice(["umido", "arido"], ["umido", "arido"]); // "best-first"
 */
export function describeSeverityChoice(
  order: readonly string[],
  classIds: readonly string[],
): ReportSeverityChoice {
  if (order.length < 2) return "none";

  const coversSameClasses =
    order.length === classIds.length &&
    order.every((id) => classIds.includes(id));
  if (!coversSameClasses) return "stale";
  if (order.every((id, index) => id === classIds[index])) return "best-first";
  if (order.every((id, index) => id === classIds.at(-1 - index))) {
    return "worst-first";
  }
  return "stale";
}

/** A ordem que a resposta do operador grava, na ordem das classes da tela. */
export function toSeverityOrder(
  choice: ReportSeverityChoice,
  classIds: readonly string[],
): string[] {
  if (choice === "best-first") return [...classIds];
  if (choice === "worst-first") return [...classIds].reverse();
  return [];
}
