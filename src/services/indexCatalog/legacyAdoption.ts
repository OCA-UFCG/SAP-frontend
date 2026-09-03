import "server-only";

import { tryParsePublishedPanelLayerReportConfig } from "@/contracts/panelLayerReport";
import type { AuthenticatedUserSession } from "@/lib/server-session";
import {
  catalogTimestamp,
  withAuditEvent,
} from "@/services/indexCatalog/catalogConfigAudit";
import {
  ensureIndexCatalogContentModel,
  getCatalogEntry,
  getLocalizedEntryField,
  getManagementEntry,
  patchManagementEntry,
} from "@/services/indexCatalog/contentfulManagement";
import {
  INDEX_CATEGORIES,
  isManagedCatalogConfig,
  type IndexCatalogItem,
  type IndexCatalogPresentationConfigV2,
} from "@/types/indexCatalog";

export interface AdoptedIndexCatalogEntry {
  entryId: string;
  panelLayerId: string;
  managedScope: "presentation";
  status: IndexCatalogPresentationConfigV2["status"];
}

/**
 * A categoria de um legado sempre é uma das três do catálogo na base atual; o
 * fallback existe para uma entry incompleta não impedir a adoção, e o
 * formulário obriga o operador a escolher antes de republicar.
 */
function resolveAdoptedCategory(item: IndexCatalogItem) {
  return (
    INDEX_CATEGORIES.find((category) => category === item.category) ??
    INDEX_CATEGORIES[0]
  );
}

function toAdoptedConfig(
  item: IndexCatalogItem,
  reportConfig: ReturnType<typeof tryParsePublishedPanelLayerReportConfig>,
  user: AuthenticatedUserSession,
): IndexCatalogPresentationConfigV2 {
  const at = catalogTimestamp();
  const author = { uid: user.uid, email: user.email, at };
  return {
    schemaVersion: 2,
    managedScope: "presentation",
    panelLayerId: item.panelLayerId,
    status: item.published ? "published" : "draft",
    name: item.name,
    description: item.description,
    category: resolveAdoptedCategory(item),
    measurementUnit: item.measurementUnit ?? "",
    ...(typeof item.panelPosition === "number"
      ? { panelPosition: item.panelPosition }
      : {}),
    ...(reportConfig ? { report: reportConfig } : {}),
    createdBy: author,
    updatedBy: author,
    adoptedFrom: {
      at,
      ...(item.catalogConfig?.schemaVersion === 1
        ? { previousSchemaVersion: 1 as const }
        : {}),
    },
  };
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
  const config = withAuditEvent(
    toAdoptedConfig(
      current.item,
      tryParsePublishedPanelLayerReportConfig(
        getLocalizedEntryField(current.entry, "reportConfig", current.locale),
      ),
      user,
    ),
    user,
    { action: "adopt", outcome: "success" },
  );
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
