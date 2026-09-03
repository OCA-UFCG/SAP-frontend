import "server-only";

import {
  parsePublishedPanelLayerReportConfig,
  type PublishedPanelLayerReportConfig,
} from "@/contracts/panelLayerReport";
import type { AuthenticatedUserSession } from "@/lib/server-session";
import {
  catalogTimestamp,
  requireManagedConfig,
  withAuditEvent,
} from "@/services/indexCatalog/catalogConfigAudit";
import {
  ensureIndexCatalogContentModel,
  getCatalogEntry,
  getManagementEntry,
  patchManagementEntry,
} from "@/services/indexCatalog/contentfulManagement";

export interface SavedIndexCatalogReportText {
  entryId: string;
  panelLayerId: string;
  sectionCount: number;
  /**
   * True quando a entry já estava publicada: o Relatório Automático lê o
   * `panelLayer` publicado, então o texto novo só chega ao relatório na próxima
   * publicação — e a tela precisa dizer isso.
   */
  requiresRepublish: boolean;
}

/**
 * Grava o texto do Relatório Automático de um índice do catálogo.
 *
 * Tem rota própria, e não o `PUT` do rascunho, por um motivo concreto:
 * `updateIndexCatalogDraft` derruba `status` para `"draft"` e apaga
 * `validation`/`validatedStatisticsSource`, obrigando uma revalidação inteira no
 * Earth Engine. Corrigir uma vírgula na narrativa não pode custar isso. O
 * caminho aqui é o mesmo de `saveIndexCatalogPreviewMap`: escreve o campo do
 * `panelLayer` e o registro no `catalogConfig` numa única alteração, sem tocar
 * na prévia já validada.
 *
 * @example
 * await saveIndexCatalogReportText(entryId, { schemaVersion: 1, sections: [] }, user);
 */
export async function saveIndexCatalogReportText(
  entryId: string,
  rawReport: unknown,
  user: AuthenticatedUserSession,
): Promise<SavedIndexCatalogReportText> {
  const current = await getCatalogEntry(entryId);
  const config = requireManagedConfig(current);
  const report = parsePublishedPanelLayerReportConfig(rawReport);
  const stored = toStoredReportConfig(report);
  await ensureIndexCatalogContentModel();

  await patchManagementEntry(await getManagementEntry(entryId), {
    reportConfig: stored,
    catalogConfig: withAuditEvent(
      {
        ...config,
        report: stored,
        updatedBy: { uid: user.uid, email: user.email, at: catalogTimestamp() },
      },
      user,
      { action: "report-text", outcome: "success" },
    ),
  });

  return {
    entryId,
    panelLayerId: config.panelLayerId,
    sectionCount: report.sections.length,
    requiresRepublish: current.item.published,
  };
}

/**
 * Um índice sem nenhuma seção, cor ou nota volta a não ter `reportConfig`: é
 * `undefined` que faz `patchManagementEntry` apagar o campo, e é a ausência do
 * campo que devolve o índice ao texto do Google Docs em vez de deixá-lo com um
 * bloco vazio no relatório.
 */
function toStoredReportConfig(report: PublishedPanelLayerReportConfig) {
  const isEmpty =
    report.sections.length === 0 && !report.sectionColor && !report.methodology;
  return isEmpty ? undefined : report;
}
