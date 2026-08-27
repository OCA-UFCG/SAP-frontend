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
  catalogTimestamp,
  requireManagedConfig,
  withAuditEvent,
} from "@/services/indexCatalog/catalogConfigAudit";
import { getIndexCatalogPreviewMapUrl } from "@/services/indexCatalog/previewMapService";
import {
  type CatalogValidationReport,
  type IndexCatalogConfigV2,
  type IndexCatalogDraftInput,
  type IndexCatalogLifecycleImpact,
  type IndexCatalogPreview,
} from "@/types/indexCatalog";
import {
  createCatalogPanelLayerId,
  makeUniqueCatalogPanelLayerId,
  parseIndexCatalogDraftInput,
  resolvePanelPositionInCategory,
} from "@/utils/indexCatalog";

function toInitialConfig(
  input: IndexCatalogDraftInput,
  panelLayerId: string,
  user: AuthenticatedUserSession,
) {
  const timestamp = catalogTimestamp();
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

/**
 * O ID técnico do panelLayer nasce do primeiro nome salvo, porque o formulário
 * não pede um. Enquanto a entry nunca foi publicada nada aponta para esse ID,
 * então ele acompanha o nome; depois da primeira publicação ele congela, já que
 * telemetria, relatórios, caches e a URL do Monitoramento usam esse ID como
 * chave. É por isso que um índice criado como "Teste temperatura" e renomeado
 * depois continua sendo `teste-temperatura`.
 */
async function resolveDraftPanelLayerId(
  entry: ContentfulManagementEntry,
  config: IndexCatalogConfigV2,
  name: string,
) {
  if (entry.sys.firstPublishedAt || entry.sys.publishedAt) {
    return config.panelLayerId;
  }

  const candidate = createCatalogPanelLayerId(name);
  if (candidate === config.panelLayerId) {
    return config.panelLayerId;
  }

  const entries = await listCatalogEntries();
  return makeUniqueCatalogPanelLayerId(
    name,
    entries
      .filter((item) => item.entryId !== entry.sys.id)
      .map((item) => item.panelLayerId),
  );
}

export async function updateIndexCatalogDraft(
  entryId: string,
  rawInput: unknown,
  user: AuthenticatedUserSession,
) {
  const input = parseIndexCatalogDraftInput(rawInput);
  const current = await getCatalogEntry(entryId);
  const previous = requireManagedConfig(current);
  const panelLayerId = await resolveDraftPanelLayerId(
    current.entry,
    previous,
    input.name,
  );
  const config = withAuditEvent(
    {
      ...previous,
      ...input,
      panelLayerId,
      status: "draft",
      validation: undefined,
      validatedStatisticsSource: undefined,
      updatedBy: { uid: user.uid, email: user.email, at: catalogTimestamp() },
    },
    user,
    { action: "update", outcome: "success" },
  );
  const updated = await patchManagementEntry(current.entry, {
    id: panelLayerId,
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

async function buildCatalogPreviewResponse(
  entry: ContentfulManagementEntry,
  locale: string,
  config: IndexCatalogConfigV2,
  imageData = getLocalizedEntryField(
    entry,
    "imageData",
    locale,
  ) as IndexCatalogPreview["panelLayer"]["imageData"],
): Promise<IndexCatalogPreview> {
  if (
    !config.validation?.valid ||
    !config.validatedStatisticsSource ||
    !imageData
  ) {
    throw new Error("O rascunho ainda não possui uma prévia válida.");
  }

  const previewMapUrl = await getIndexCatalogPreviewMapUrl(entry, locale);

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
      previewMap: previewMapUrl ? { url: previewMapUrl } : null,
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
        updatedBy: { uid: user.uid, email: user.email, at: catalogTimestamp() },
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
        panelPosition: resolvePanelPositionInCategory(
          entries,
          config.category,
          entryId,
        ),
        timeScale: build.validation.inferred.timeScale,
        imageData: build.panelLayerImageData,
        statisticsSource: build.statisticsSource,
        catalogConfig: readyConfig,
      },
    );
    return await buildCatalogPreviewResponse(
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
        updatedBy: { uid: user.uid, email: user.email, at: catalogTimestamp() },
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
        updatedBy: { uid: user.uid, email: user.email, at: catalogTimestamp() },
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
    // Sem essa checagem, a rota responderia "publicado" para uma entry que
    // continuou em rascunho e o índice ficaria invisível no Monitoramento sem
    // nenhum sinal na tela do catálogo.
    if (!published.sys.publishedAt) {
      throw new Error(
        `O Contentful não confirmou a publicação da entry ${entryId}: sys.publishedAt ausente. O índice continuaria em rascunho e fora do Monitoramento.`,
      );
    }
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
        updatedBy: { uid: user.uid, email: user.email, at: catalogTimestamp() },
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
        updatedBy: { uid: user.uid, email: user.email, at: catalogTimestamp() },
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

  try {
    await deleteManagementEntry(entry);
  } catch (error) {
    // A entry já foi despublicada aqui: sem esse log, o índice sai do
    // Monitoramento e sobra um rascunho sem nenhum registro do motivo.
    console.error(
      `[indexCatalog] entry ${entry.sys.id} foi despublicada mas a remoção falhou; ela permanece como rascunho no Contentful.`,
      error,
    );
    throw error;
  }
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
    at: catalogTimestamp(),
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
