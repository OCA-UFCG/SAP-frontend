import "server-only";

import type { AuthenticatedUserSession } from "@/lib/server-session";
import {
  catalogTimestamp,
  requireManagedConfig,
  withAuditEvent,
} from "@/services/indexCatalog/catalogConfigAudit";
import {
  ensureIndexCatalogContentModel,
  getCatalogEntry,
  patchManagementEntry,
} from "@/services/indexCatalog/contentfulManagement";
import { parseLearnMoreUrl } from "@/utils/indexCatalog";

/**
 * Grava o link do botão "Saiba mais" de um índice do catálogo, nos dois escopos.
 *
 * Tem rota própria pelo mesmo motivo do texto do relatório
 * (`saveIndexCatalogReportText`): o `PUT` do rascunho derruba a validação, e
 * trocar um link não pode custar uma nova conferência dos assets no Earth
 * Engine. Campo vazio apaga `panelLayer.learnMoreUrl`, e o índice fica sem o
 * botão.
 *
 * @example
 * await saveIndexCatalogLearnMoreUrl(entryId, "https://www.gov.br/ana", user);
 */
export async function saveIndexCatalogLearnMoreUrl(
  entryId: string,
  rawUrl: unknown,
  user: AuthenticatedUserSession,
) {
  const current = await getCatalogEntry(entryId);
  const config = requireManagedConfig(current);
  const learnMoreUrl = parseLearnMoreUrl(rawUrl);
  await ensureIndexCatalogContentModel();

  await patchManagementEntry(current.entry, {
    learnMoreUrl,
    catalogConfig: withAuditEvent(
      {
        ...config,
        learnMoreUrl,
        updatedBy: { uid: user.uid, email: user.email, at: catalogTimestamp() },
      },
      user,
      { action: "learn-more-url", outcome: "success" },
    ),
  });

  return {
    entryId,
    panelLayerId: config.panelLayerId,
    learnMoreUrl: learnMoreUrl ?? null,
    // A plataforma lê o `panelLayer` publicado: o link novo só aparece lá
    // depois da próxima publicação.
    requiresRepublish: current.item.published,
  };
}
