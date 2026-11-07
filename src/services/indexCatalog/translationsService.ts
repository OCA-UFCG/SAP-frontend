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
import { parseIndexTranslations } from "@/utils/indexCatalog";

/**
 * Grava o inglês e o espanhol de um índice: nome, descrição e rótulos das
 * classes, nos campos `nameEn`, `descriptionEs`, `classLabelsEn`... do
 * `panelLayer`.
 *
 * Tem rota própria pelo mesmo motivo do link do "Saiba mais": o `PUT` do
 * rascunho derruba a validação, e traduzir um nome não pode custar uma nova
 * conferência dos assets no Earth Engine. Campo vazio apaga a tradução, e a
 * plataforma volta a mostrar o português.
 *
 * @example
 * await saveIndexCatalogTranslations(entryId, { en: { name: "Drought" } }, user);
 */
export async function saveIndexCatalogTranslations(
  entryId: string,
  rawTranslations: unknown,
  user: AuthenticatedUserSession,
) {
  const current = await getCatalogEntry(entryId);
  const config = requireManagedConfig(current);
  const translations = parseIndexTranslations(rawTranslations);
  await ensureIndexCatalogContentModel();

  const { en, es } = translations;
  await patchManagementEntry(current.entry, {
    nameEn: en?.name,
    nameEs: es?.name,
    descriptionEn: en?.description,
    descriptionEs: es?.description,
    classLabelsEn: en?.classLabels,
    classLabelsEs: es?.classLabels,
    catalogConfig: withAuditEvent(
      {
        ...config,
        updatedBy: { uid: user.uid, email: user.email, at: catalogTimestamp() },
      },
      user,
      { action: "translations", outcome: "success" },
    ),
  });

  return {
    entryId,
    panelLayerId: config.panelLayerId,
    translations,
    // A plataforma lê o `panelLayer` publicado: a tradução só aparece lá
    // depois da próxima publicação.
    requiresRepublish: current.item.published,
  };
}
