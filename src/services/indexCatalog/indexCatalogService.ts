import "server-only";

import type { AuthenticatedUserSession } from "@/lib/server-session";
import { getGeeStatisticsYearPatch } from "@/repositories/platform/geeStatisticsRepository";
import {
  buildCatalogDraft,
  getCatalogBuildValidation,
} from "@/services/indexCatalog/catalogBuild";
import {
  createPanelLayerDraft,
  deleteManagementEntry,
  ensureIndexCatalogContentModel,
  getCatalogEntry,
  getLocalizedEntryField,
  getManagementEntry,
  listCatalogEntries,
  patchManagementEntry,
  publishManagementEntry,
  unpublishManagementEntry,
  type ContentfulManagementEntry,
} from "@/services/indexCatalog/contentfulManagement";
import {
  isIndexCatalogConfigV2,
  type CatalogValidationReport,
  type IndexCatalogConfigV2,
  type IndexCatalogDraftInput,
  type IndexCatalogLifecycleImpact,
  type IndexCatalogPreview,
} from "@/types/indexCatalog";
import {
  makeUniqueCatalogPanelLayerId,
  parseIndexCatalogDraftInput,
} from "@/utils/indexCatalog";

function now() {
  return new Date().toISOString();
}

function withAuditEvent(
  config: IndexCatalogConfigV2,
  user: AuthenticatedUserSession,
  event: {
    action: NonNullable<IndexCatalogConfigV2["auditLog"]>[number]["action"];
    outcome: "success" | "failure";
    message?: string;
  },
): IndexCatalogConfigV2 {
  return {
    ...config,
    auditLog: [
      ...(config.auditLog ?? []),
      { ...event, uid: user.uid, email: user.email, at: now() },
    ].slice(-50),
  };
}

function requireManagedConfig(
  current: Awaited<ReturnType<typeof getCatalogEntry>>,
) {
  if (!isIndexCatalogConfigV2(current.item.catalogConfig)) {
    throw new Error(
      "Este índice é legado e está disponível apenas para consulta. Crie um índice v2 para gerenciá-lo pelo catálogo.",
    );
  }
  return current.item.catalogConfig;
}

function toInitialConfig(
  input: IndexCatalogDraftInput,
  panelLayerId: string,
  user: AuthenticatedUserSession,
) {
  const timestamp = now();
  const config: IndexCatalogConfigV2 = {
    schemaVersion: 2,
    panelLayerId,
    status: "draft",
    ...input,
    createdBy: { uid: user.uid, email: user.email, at: timestamp },
    updatedBy: { uid: user.uid, email: user.email, at: timestamp },
  };
  return withAuditEvent(config, user, {
    action: "create",
    outcome: "success",
  });
}

export async function createIndexCatalogDraft(
  rawInput: unknown,
  user: AuthenticatedUserSession,
) {
  const input = parseIndexCatalogDraftInput(rawInput);
  await ensureIndexCatalogContentModel();
  const existing = await listCatalogEntries();
  const panelLayerId = makeUniqueCatalogPanelLayerId(
    input.name,
    existing.map((entry) => entry.panelLayerId),
  );
  const config = toInitialConfig(input, panelLayerId, user);
  const entry = await createPanelLayerDraft({
    id: panelLayerId,
    name: input.name,
    description: input.description,
    measurementUnit: "%",
    category: input.category,
    catalogConfig: config,
  });

  return { entryId: entry.sys.id, panelLayerId, status: config.status };
}

export async function updateIndexCatalogDraft(
  entryId: string,
  rawInput: unknown,
  user: AuthenticatedUserSession,
) {
  const input = parseIndexCatalogDraftInput(rawInput);
  const current = await getCatalogEntry(entryId);
  const previous = requireManagedConfig(current);
  const config = withAuditEvent(
    {
      ...previous,
      ...input,
      status: "draft",
      validation: undefined,
      validatedStatisticsSource: undefined,
      updatedBy: { uid: user.uid, email: user.email, at: now() },
    },
    user,
    { action: "update", outcome: "success" },
  );
  const updated = await patchManagementEntry(current.entry, {
    name: input.name,
    description: input.description,
    measurementUnit: "%",
    category: input.category,
    catalogConfig: config,
  });

  return {
    entryId: updated.sys.id,
    panelLayerId: config.panelLayerId,
    status: config.status,
  };
}

function getNextPanelPosition(
  entries: Awaited<ReturnType<typeof listCatalogEntries>>,
  category: string,
  entryId: string,
) {
  const currentPosition = entries.find(
    (entry) => entry.entryId === entryId,
  )?.panelPosition;
  if (typeof currentPosition === "number") return currentPosition;
  const positions = entries
    .filter((entry) => entry.entryId !== entryId && entry.category === category)
    .flatMap((entry) =>
      typeof entry.panelPosition === "number" ? [entry.panelPosition] : [],
    );
  return positions.length > 0
    ? Math.max(...positions) + 1
    : entries.filter((entry) => entry.category === category).length;
}

function buildCatalogPreviewResponse(
  entry: ContentfulManagementEntry,
  locale: string,
  config: IndexCatalogConfigV2,
  imageData = getLocalizedEntryField(
    entry,
    "imageData",
    locale,
  ) as IndexCatalogPreview["panelLayer"]["imageData"],
): IndexCatalogPreview {
  if (
    !config.validation?.valid ||
    !config.validatedStatisticsSource ||
    !imageData
  ) {
    throw new Error("O rascunho ainda não possui uma prévia válida.");
  }

  return {
    entryId: entry.sys.id,
    panelLayer: {
      sys: { id: entry.sys.id },
      id: config.panelLayerId,
      name: config.name,
      description: config.description,
      category: config.category,
      panelPosition: getLocalizedEntryField<number>(
        entry,
        "panelPosition",
        locale,
      ),
      previewMap: null,
      imageData,
      timeScale: config.validation.inferred.timeScale,
      statisticsSource: config.validatedStatisticsSource,
      tileApiPath: `/api/index-catalog/drafts/${entry.sys.id}/ee`,
      municipalAnalysisApiPath: `/api/index-catalog/drafts/${entry.sys.id}/municipal-analysis`,
    },
    validation: config.validation,
  };
}

export async function generateIndexCatalogPreview(
  entryId: string,
  user: AuthenticatedUserSession,
) {
  const current = await getCatalogEntry(entryId);
  const config = requireManagedConfig(current);

  try {
    const build = await buildCatalogDraft(config);
    const entries = await listCatalogEntries();
    const readyConfig = withAuditEvent(
      {
        ...config,
        classes: build.classes,
        status: "ready",
        validation: build.validation,
        validatedStatisticsSource: build.statisticsSource,
        updatedBy: { uid: user.uid, email: user.email, at: now() },
      },
      user,
      { action: "preview", outcome: "success" },
    );
    const updated = await patchManagementEntry(
      await getManagementEntry(entryId),
      {
        id: config.panelLayerId,
        name: config.name,
        description: config.description,
        measurementUnit: "%",
        category: config.category,
        panelPosition: getNextPanelPosition(entries, config.category, entryId),
        timeScale: build.validation.inferred.timeScale,
        imageData: build.panelLayerImageData,
        statisticsSource: build.statisticsSource,
        catalogConfig: readyConfig,
      },
    );
    return buildCatalogPreviewResponse(
      updated,
      current.locale,
      readyConfig,
      build.panelLayerImageData,
    );
  } catch (error) {
    const validation = getCatalogBuildValidation(error);
    const errorConfig = withAuditEvent(
      {
        ...config,
        status: "error",
        ...(validation ? { validation } : {}),
        updatedBy: { uid: user.uid, email: user.email, at: now() },
      },
      user,
      {
        action: "preview",
        outcome: "failure",
        message: error instanceof Error ? error.message : String(error),
      },
    );
    await patchManagementEntry(await getManagementEntry(entryId), {
      catalogConfig: errorConfig,
    });
    throw error;
  }
}

export async function getIndexCatalogPreview(entryId: string) {
  const current = await getCatalogEntry(entryId);
  const config = requireManagedConfig(current);
  return buildCatalogPreviewResponse(current.entry, current.locale, config);
}

export async function getIndexCatalogDraftMunicipalData(
  entryId: string,
  year: string,
  locationKey: string,
) {
  const current = await getCatalogEntry(entryId);
  const config = requireManagedConfig(current);
  if (!config.validation?.valid || !config.validatedStatisticsSource) {
    return null;
  }

  const result = await getGeeStatisticsYearPatch(
    config.panelLayerId,
    year,
    locationKey,
    config.classes.length,
    config.validatedStatisticsSource,
  );
  return result ? { imageData: result.patch } : null;
}

function assertPublishable(config: IndexCatalogConfigV2) {
  if (
    config.status !== "ready" ||
    !config.validation?.valid ||
    !config.validatedStatisticsSource
  ) {
    throw new Error("Revalide os assets e gere a prévia antes de publicar.");
  }
}

export async function publishIndexCatalogDraft(
  entryId: string,
  user: AuthenticatedUserSession,
) {
  const current = await getCatalogEntry(entryId);
  const config = requireManagedConfig(current);
  assertPublishable(config);

  try {
    const build = await buildCatalogDraft(config);
    if (
      build.validation.sourceFingerprint !==
      config.validation!.sourceFingerprint
    ) {
      throw new Error(
        "Os assets ou a configuração mudaram desde a última prévia. Revalide antes de publicar.",
      );
    }
    const publishedConfig = withAuditEvent(
      {
        ...config,
        classes: build.classes,
        status: "published",
        validation: build.validation,
        validatedStatisticsSource: build.statisticsSource,
        updatedBy: { uid: user.uid, email: user.email, at: now() },
      },
      user,
      { action: "publish", outcome: "success" },
    );
    const latestPanelLayer = await patchManagementEntry(
      await getManagementEntry(entryId),
      {
        imageData: build.panelLayerImageData,
        statisticsSource: build.statisticsSource,
        catalogConfig: publishedConfig,
      },
    );
    const published = await publishManagementEntry(latestPanelLayer);
    return {
      entryId: published.sys.id,
      panelLayerId: config.panelLayerId,
      status: "published" as const,
    };
  } catch (error) {
    const failedConfig = withAuditEvent(
      {
        ...config,
        status: "ready",
        updatedBy: { uid: user.uid, email: user.email, at: now() },
      },
      user,
      {
        action: "publish",
        outcome: "failure",
        message: error instanceof Error ? error.message : String(error),
      },
    );
    try {
      await patchManagementEntry(await getManagementEntry(entryId), {
        catalogConfig: failedConfig,
      });
    } catch (auditError) {
      console.error("Falha ao registrar erro de publicação:", auditError);
    }
    throw error;
  }
}

export async function getIndexCatalogLifecycleImpact(
  entryId: string,
): Promise<IndexCatalogLifecycleImpact> {
  const current = await getCatalogEntry(entryId);
  requireManagedConfig(current);
  return {
    item: current.item,
    linkedEntries: [],
    counts: {
      panelLayer: 1,
      municipalAnalysis: 0,
      municipalReportSeries: 0,
      total: 1,
    },
  };
}

export async function publishIndexCatalogEntry(
  entryId: string,
  user: AuthenticatedUserSession,
) {
  const current = await getCatalogEntry(entryId);
  const config = requireManagedConfig(current);
  if (current.item.published && !current.item.hasUnpublishedChanges) {
    return {
      entryId,
      panelLayerId: config.panelLayerId,
      status: "published" as const,
    };
  }
  return publishIndexCatalogDraft(entryId, user);
}

export async function unpublishIndexCatalogEntry(
  entryId: string,
  user: AuthenticatedUserSession,
) {
  const current = await getCatalogEntry(entryId);
  const config = requireManagedConfig(current);
  if (!current.item.published) {
    return {
      entryId,
      panelLayerId: config.panelLayerId,
      status: config.status,
    };
  }
  const status = config.validation?.valid ? "ready" : "draft";
  const patched = await patchManagementEntry(current.entry, {
    catalogConfig: withAuditEvent(
      {
        ...config,
        status,
        updatedBy: { uid: user.uid, email: user.email, at: now() },
      },
      user,
      { action: "unpublish", outcome: "success" },
    ),
  });
  await unpublishManagementEntry(patched);
  return { entryId, panelLayerId: config.panelLayerId, status };
}

async function deleteEntryCompletely(entry: ContentfulManagementEntry) {
  if (entry.sys.publishedAt) {
    await unpublishManagementEntry(entry);
    entry = await getManagementEntry(entry.sys.id);
  }
  await deleteManagementEntry(entry);
}

export async function deleteIndexCatalogEntry(
  entryId: string,
  confirmation: string,
  user: AuthenticatedUserSession,
) {
  const current = await getCatalogEntry(entryId);
  const config = requireManagedConfig(current);
  if (confirmation.trim() !== config.panelLayerId) {
    throw new Error(
      "Confirme a remoção informando exatamente o ID técnico do índice.",
    );
  }
  await deleteEntryCompletely(current.entry);
  console.info("Ciclo de vida do catálogo", {
    action: "delete",
    outcome: "success",
    entryId,
    panelLayerId: config.panelLayerId,
    deletedEntries: 1,
    uid: user.uid,
    email: user.email,
    at: now(),
  });
  return {
    entryId,
    panelLayerId: config.panelLayerId,
    status: "deleted" as const,
    deletedEntries: 1,
  };
}

export function getCatalogValidationFromError(
  error: unknown,
): CatalogValidationReport | null {
  return getCatalogBuildValidation(error);
}
