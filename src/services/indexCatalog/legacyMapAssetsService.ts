import "server-only";

import type { AuthenticatedUserSession } from "@/lib/server-session";
import {
  catalogTimestamp,
  requirePresentationConfig,
  withAuditEvent,
} from "@/services/indexCatalog/catalogConfigAudit";
import {
  getCatalogEntry,
  patchManagementEntry,
} from "@/services/indexCatalog/contentfulManagement";
import { readCompactImageData } from "@/services/indexCatalog/presentationImageData";
import {
  applyLegacyMapAssets,
  parseLegacyMapAssetsInput,
  readLegacyMapAssets,
  summarizeLegacyMapAssetsChange,
  type LegacyMapAssets,
} from "@/utils/legacyMapAssets";

export interface IndexCatalogMapAssetsResponse {
  entryId: string;
  panelLayerId: string;
  assets: LegacyMapAssets;
}

/**
 * Os assets do Earth Engine que desenham o mapa deste índice legado hoje.
 *
 * @example
 * await getIndexCatalogMapAssets(entryId); // => { assets: { rows: [{ period: "2001", imageId: "..." }] } }
 */
export async function getIndexCatalogMapAssets(
  entryId: string,
): Promise<IndexCatalogMapAssetsResponse> {
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
    assets: readLegacyMapAssets(imageData),
  };
}

export interface IndexCatalogMapAssetsUpdate extends IndexCatalogMapAssetsResponse {
  /** Resumo do que mudou, ou "nada" quando a tela reenviou o que já estava gravado. */
  changed: string;
  requiresRepublish: boolean;
}

/**
 * Troca o asset do mapa dos períodos que o índice legado já tem.
 *
 * É a segunda escrita do escopo de apresentação que toca o `imageData`, e segue
 * o mesmo cuidado da aparência: o corpo traz apenas pares período/asset, o
 * servidor relê o objeto gravado e aplica a troca em cima dele, e uma
 * conferência recusa qualquer alteração que passe do id do asset.
 *
 * A origem dos números não muda — as estatísticas de um legado continuam vindo
 * das partições `municipalAnalysis`. O que muda é qual imagem o Earth Engine
 * desenha.
 *
 * Uma edição que não muda nada não grava: cada `patch` cria uma versão nova e
 * marcaria um índice publicado como "alterações não publicadas" à toa.
 *
 * @example
 * await updateIndexCatalogMapAssets(entryId, { assets: [...] }, user);
 */
export async function updateIndexCatalogMapAssets(
  entryId: string,
  rawInput: unknown,
  user: AuthenticatedUserSession,
): Promise<IndexCatalogMapAssetsUpdate> {
  const current = await getCatalogEntry(entryId);
  const previous = requirePresentationConfig(current);
  const imageData = readCompactImageData(
    current.entry,
    current.locale,
    previous.panelLayerId,
  );
  const next = applyLegacyMapAssets(
    imageData,
    parseLegacyMapAssetsInput(rawInput),
  );
  const changed = summarizeLegacyMapAssetsChange(imageData, next);
  const unchanged = {
    entryId,
    panelLayerId: previous.panelLayerId,
    assets: readLegacyMapAssets(next),
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
    { action: "map-asset", outcome: "success", message: changed },
  );
  await patchManagementEntry(current.entry, {
    imageData: next,
    catalogConfig: config,
  });

  return { ...unchanged, requiresRepublish: current.item.published };
}
