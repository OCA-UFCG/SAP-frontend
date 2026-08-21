import "server-only";

import type { AuthenticatedUserSession } from "@/lib/server-session";
import {
  catalogTimestamp,
  requireManagedConfig,
  withAuditEvent,
} from "@/services/indexCatalog/catalogConfigAudit";
import {
  getAssetFileUrl,
  getContentfulAsset,
  saveContentfulPreviewImage,
} from "@/services/indexCatalog/contentfulAssets";
import {
  getCatalogEntry,
  getLocalizedEntryField,
  getManagementEntry,
  patchManagementEntry,
  type ContentfulManagementEntry,
} from "@/services/indexCatalog/contentfulManagement";
import { decodePreviewMapDataUrl } from "@/utils/previewMapImage";

interface AssetLinkField {
  sys?: { id?: string };
}

export interface SavedIndexCatalogPreviewMap {
  entryId: string;
  panelLayerId: string;
  assetId: string;
  url: string;
  /**
   * True quando a entry já estava publicada: a imagem nova só chega ao
   * Monitoramento na próxima publicação, e a tela precisa dizer isso.
   */
  requiresRepublish: boolean;
}

function readPreviewMapAssetId(
  entry: ContentfulManagementEntry,
  locale: string,
) {
  return getLocalizedEntryField<AssetLinkField>(entry, "previewMap", locale)
    ?.sys?.id;
}

/**
 * URL da imagem de prévia ligada à entry, ou `null` quando não existe. Lê o
 * asset em vez de guardar a URL no `catalogConfig` para que o Contentful siga
 * sendo a única fonte da verdade sobre o arquivo.
 */
export async function getIndexCatalogPreviewMapUrl(
  entry: ContentfulManagementEntry,
  locale: string,
): Promise<string | null> {
  const assetId = readPreviewMapAssetId(entry, locale);
  if (!assetId) return null;

  try {
    return getAssetFileUrl(await getContentfulAsset(assetId), locale);
  } catch (error) {
    console.error(
      `[indexCatalog] imagem de prévia indisponível para a entry ${entry.sys.id}: asset ${assetId}`,
      error,
    );
    return null;
  }
}

/**
 * Guarda a captura do mapa feita na validação como asset do Contentful e liga
 * o asset ao campo `previewMap` do panelLayer — é ele que virá a ser a imagem
 * do índice no Monitoramento.
 */
export async function saveIndexCatalogPreviewMap(
  entryId: string,
  rawImage: unknown,
  user: AuthenticatedUserSession,
): Promise<SavedIndexCatalogPreviewMap> {
  const current = await getCatalogEntry(entryId);
  const config = requireManagedConfig(current);
  const image = decodePreviewMapDataUrl(rawImage, config.panelLayerId);

  const saved = await saveContentfulPreviewImage({
    assetId: config.previewMap?.assetId,
    bytes: image.bytes,
    contentType: image.contentType,
    fileName: image.fileName,
    title: `Prévia do mapa — ${config.name}`,
    locale: current.locale,
  });

  await patchManagementEntry(await getManagementEntry(entryId), {
    previewMap: { sys: { type: "Link", linkType: "Asset", id: saved.assetId } },
    catalogConfig: withAuditEvent(
      {
        ...config,
        previewMap: { assetId: saved.assetId, capturedAt: catalogTimestamp() },
        updatedBy: { uid: user.uid, email: user.email, at: catalogTimestamp() },
      },
      user,
      { action: "preview-map", outcome: "success" },
    ),
  });

  return {
    entryId,
    panelLayerId: config.panelLayerId,
    assetId: saved.assetId,
    url: saved.url,
    requiresRepublish: current.item.published,
  };
}
