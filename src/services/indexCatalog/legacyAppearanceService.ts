import "server-only";

import type { AuthenticatedUserSession } from "@/lib/server-session";
import {
  catalogTimestamp,
  requirePresentationConfig,
  withAuditEvent,
} from "@/services/indexCatalog/catalogConfigAudit";
import {
  getCatalogEntry,
  getLocalizedEntryField,
  patchManagementEntry,
} from "@/services/indexCatalog/contentfulManagement";
import { readCompactImageData } from "@/services/indexCatalog/presentationImageData";
import {
  readLegacyClassification,
  type LegacyClassification,
} from "@/utils/legacyClassification";
import {
  applyLegacyAppearance,
  parseLegacyAppearanceInput,
  readLegacyAppearance,
  summarizeLegacyAppearanceChange,
  type LegacyAppearance,
} from "@/utils/legacyAppearance";

export interface IndexCatalogAppearanceResponse {
  entryId: string;
  panelLayerId: string;
  appearance: LegacyAppearance;
  /** Quantos períodos usam esta legenda — o alcance da alteração. */
  periodCount: number;
  /**
   * Como o mapa deste legado classifica o raster. Não é editável por aqui:
   * serve para o formulário v2 nascer com a mesma classificação em vez de
   * supor que cada classe é um código de 1 a N.
   */
  classification: LegacyClassification;
}

/**
 * Os rótulos, as cores e os limites que este índice legado tem hoje.
 *
 * @example
 * await getIndexCatalogAppearance(entryId); // => { appearance: { legend: [...] } }
 */
export async function getIndexCatalogAppearance(
  entryId: string,
): Promise<IndexCatalogAppearanceResponse> {
  const current = await getCatalogEntry(entryId);
  const config = requirePresentationConfig(current);
  const imageData = readCompactImageData(
    current.entry,
    current.locale,
    config.panelLayerId,
  );

  return {
    entryId,
    panelLayerId: config.panelLayerId,
    appearance: readLegacyAppearance(imageData),
    periodCount: Object.keys(imageData.years).length,
    classification: readLegacyClassification(imageData, {
      minScale: getLocalizedEntryField<number>(
        current.entry,
        "minScale",
        current.locale,
      ),
      maxScale: getLocalizedEntryField<number>(
        current.entry,
        "maxScale",
        current.locale,
      ),
    }),
  };
}

export interface IndexCatalogAppearanceUpdate extends IndexCatalogAppearanceResponse {
  /** Resumo do que mudou, ou "nada" quando a tela reenviou o que já estava gravado. */
  changed: string;
  requiresRepublish: boolean;
}

/**
 * Grava rótulos, cores e limites novos de um índice legado adotado.
 *
 * Esta é a única escrita do escopo de apresentação que toca o `imageData`, e
 * por isso é a mais cuidadosa do catálogo: o mesmo campo guarda os valores
 * territoriais do índice, sem outra cópia no Contentful. A alteração é aplicada
 * pelo servidor em cima do objeto gravado (`applyLegacyAppearance`), que confere
 * antes de devolver que nada além de aparência mudou.
 *
 * Uma edição que não muda nada não grava: cada `patch` cria uma versão nova e
 * marcaria um índice publicado como "alterações não publicadas" sem que exista
 * alteração alguma.
 *
 * @example
 * await updateIndexCatalogAppearance(entryId, { legend: [...] }, user);
 */
export async function updateIndexCatalogAppearance(
  entryId: string,
  rawInput: unknown,
  user: AuthenticatedUserSession,
): Promise<IndexCatalogAppearanceUpdate> {
  const current = await getCatalogEntry(entryId);
  const previous = requirePresentationConfig(current);
  const imageData = readCompactImageData(
    current.entry,
    current.locale,
    previous.panelLayerId,
  );
  const next = applyLegacyAppearance(
    imageData,
    parseLegacyAppearanceInput(rawInput),
  );
  const changed = summarizeLegacyAppearanceChange(imageData, next);
  const unchanged = {
    entryId,
    panelLayerId: previous.panelLayerId,
    appearance: readLegacyAppearance(next),
    periodCount: Object.keys(next.years).length,
    // A classificação do raster não muda numa edição de aparência; ela viaja na
    // resposta só para a tela não precisar de um segundo pedido.
    classification: readLegacyClassification(next, {
      minScale: getLocalizedEntryField<number>(
        current.entry,
        "minScale",
        current.locale,
      ),
      maxScale: getLocalizedEntryField<number>(
        current.entry,
        "maxScale",
        current.locale,
      ),
    }),
    changed,
    requiresRepublish: false,
  };

  if (changed === "nada") return unchanged;

  const config = withAuditEvent(
    {
      ...previous,
      updatedBy: { uid: user.uid, email: user.email, at: catalogTimestamp() },
    },
    user,
    { action: "appearance", outcome: "success", message: changed },
  );
  await patchManagementEntry(current.entry, {
    imageData: next,
    catalogConfig: config,
  });

  return { ...unchanged, requiresRepublish: current.item.published };
}
