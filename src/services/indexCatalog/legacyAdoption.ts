import "server-only";

import { buildAdoptedPresentationConfig } from "@/contracts/indexCatalogAdoption.mjs";
import { tryParsePublishedPanelLayerReportConfig } from "@/contracts/panelLayerReport";
import type { AuthenticatedUserSession } from "@/lib/server-session";
import { catalogTimestamp } from "@/services/indexCatalog/catalogConfigAudit";
import {
  ensureIndexCatalogContentModel,
  getCatalogEntry,
  getLocalizedEntryField,
  getManagementEntry,
  patchManagementEntry,
} from "@/services/indexCatalog/contentfulManagement";
import {
  isManagedCatalogConfig,
  type IndexCatalogPresentationConfigV2,
} from "@/types/indexCatalog";

export interface AdoptedIndexCatalogEntry {
  entryId: string;
  panelLayerId: string;
  managedScope: "presentation";
  status: IndexCatalogPresentationConfigV2["status"];
}

/**
 * Traz um índice legado para o catálogo no escopo de apresentação.
 *
 * A adoção é inerte de propósito: escreve **somente** o `catalogConfig`, então
 * a versão publicada do índice continua exatamente a mesma e nada muda no
 * Monitoramento. O que ela faz é destravar a edição do que já morava na entry
 * — nome, descrição, categoria, posição, unidade, imagem de prévia e texto do
 * Relatório Automático —, sem tocar em `imageData`, `statisticsSource` ou nas
 * partições `municipalAnalysis` de onde os valores vêm.
 *
 * O `previewMap` existente **não** é herdado: nos legados ele é uma captura de
 * tela feita à mão, e reaproveitar o id do asset faria a primeira captura do
 * catálogo sobrescrever o arquivo original. Uma captura nova cria um asset
 * novo e religa o campo, deixando a imagem antiga intacta no espaço.
 *
 * @example
 * await adoptLegacyIndexCatalogEntry("2Kk9...", user); // => managedScope: "presentation"
 */
export async function adoptLegacyIndexCatalogEntry(
  entryId: string,
  user: AuthenticatedUserSession,
): Promise<AdoptedIndexCatalogEntry> {
  const current = await getCatalogEntry(entryId);
  if (isManagedCatalogConfig(current.item.catalogConfig)) {
    throw new Error(
      `O índice ${current.item.panelLayerId} já é gerenciado pelo catálogo.`,
    );
  }
  if (!current.item.adoptable) {
    throw new Error(
      current.item.adoptionBlockedReason ??
        `O índice ${current.item.panelLayerId} não pode ser adotado pelo catálogo.`,
    );
  }
  if (!current.item.panelLayerId.trim()) {
    throw new Error(
      `A entry ${entryId} não tem o campo id preenchido, e é ele que identifica o índice em telemetria, relatórios e caches.`,
    );
  }

  await ensureIndexCatalogContentModel();
  const config = buildAdoptedPresentationConfig({
    item: current.item,
    reportConfig: tryParsePublishedPanelLayerReportConfig(
      getLocalizedEntryField(current.entry, "reportConfig", current.locale),
    ),
    actor: user,
    at: catalogTimestamp(),
  });
  const updated = await patchManagementEntry(
    await getManagementEntry(entryId),
    {
      catalogConfig: config,
    },
  );

  return {
    entryId: updated.sys.id,
    panelLayerId: config.panelLayerId,
    managedScope: "presentation",
    status: config.status,
  };
}
