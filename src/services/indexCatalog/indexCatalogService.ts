import "server-only";

import type { AuthenticatedUserSession } from "@/lib/server-session";
import type {
  CatalogValidationReport,
  IndexCatalogConfig,
  IndexCatalogDraftInput,
  IndexCatalogLifecycleImpact,
  IndexCatalogPreview,
} from "@/types/indexCatalog";
import {
  makeUniqueCatalogPanelLayerId,
  parseIndexCatalogDraftInput,
} from "@/utils/indexCatalog";
import {
  createMunicipalAnalysisDraft,
  createPanelLayerDraft,
  deleteManagementEntry,
  ensureIndexCatalogContentModel,
  getCatalogEntry,
  getContentfulDefaultLocale,
  getLocalizedEntryField,
  getManagementEntry,
  listCatalogEntries,
  listMunicipalAnalysisEntries,
  listMunicipalReportSeriesEntries,
  patchManagementEntry,
  publishManagementEntry,
  unpublishManagementEntry,
  type ContentfulManagementEntry,
} from "@/services/indexCatalog/contentfulManagement";
import {
  buildCatalogDraft,
  getCatalogBuildValidation,
} from "@/services/indexCatalog/catalogBuild";
import { toDatasetPatch } from "@/repositories/platform/municipalAnalysisRepository";
import type { PanelLayerI } from "@/utils/interfaces";
import type { CompactTerritorialAnalysisDatasetPatch } from "@/utils/municipalAnalysisMerge";

function now() {
  return new Date().toISOString();
}

function withAuditEvent(
  config: IndexCatalogConfig,
  user: AuthenticatedUserSession,
  event: {
    action: NonNullable<IndexCatalogConfig["auditLog"]>[number]["action"];
    outcome: "success" | "failure";
    message?: string;
  },
) {
  return {
    ...config,
    auditLog: [
      ...(config.auditLog ?? []),
      {
        ...event,
        uid: user.uid,
        email: user.email,
        at: now(),
      },
    ].slice(-50),
  };
}

function assertEditableCatalogEntry(
  item: Awaited<ReturnType<typeof getCatalogEntry>>["item"],
) {
  if (item.published) {
    throw new Error("Índices publicados são somente leitura no MVP.");
  }
  if (!item.catalogManaged) {
    throw new Error("Índices legados são somente leitura no MVP.");
  }
}

function toInitialConfig(
  input: IndexCatalogDraftInput,
  panelLayerId: string,
  user: AuthenticatedUserSession,
): IndexCatalogConfig {
  const timestamp = now();
  const config: IndexCatalogConfig = {
    schemaVersion: 1,
    panelLayerId,
    status: "draft",
    ...input,
    createdBy: {
      uid: user.uid,
      email: user.email,
      at: timestamp,
    },
    updatedBy: {
      uid: user.uid,
      email: user.email,
      at: timestamp,
    },
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
    measurementUnit: input.classes.length > 1 ? "classes" : input.unit,
    category: input.category,
    catalogConfig: config,
  });

  return {
    entryId: entry.sys.id,
    panelLayerId,
    status: config.status,
  };
}

export async function updateIndexCatalogDraft(
  entryId: string,
  rawInput: unknown,
  user: AuthenticatedUserSession,
) {
  const input = parseIndexCatalogDraftInput(rawInput);
  const current = await getCatalogEntry(entryId);
  assertEditableCatalogEntry(current.item);
  const previous = current.item.catalogConfig!;
  const config = withAuditEvent(
    {
      ...previous,
      ...input,
      status: "draft",
      validation: undefined,
      derivedEntryIds: previous.derivedEntryIds,
      updatedBy: {
        uid: user.uid,
        email: user.email,
        at: now(),
      },
    },
    user,
    {
      action: "update",
      outcome: "success",
    },
  );
  const updated = await patchManagementEntry(current.entry, {
    name: input.name,
    description: input.description,
    measurementUnit: input.classes.length > 1 ? "classes" : input.unit,
    category: input.category,
    catalogConfig: config,
  });

  return {
    entryId: updated.sys.id,
    panelLayerId: config.panelLayerId,
    status: config.status,
  };
}

function getPartitionTitle(panelLayerId: string, partitionKey: string) {
  return `Municipal Analysis ${panelLayerId} ${partitionKey}`;
}

async function syncMunicipalDrafts(
  panelLayerId: string,
  partitions: Awaited<ReturnType<typeof buildCatalogDraft>>["partitions"],
) {
  const locale = await getContentfulDefaultLocale();
  const existing = await listMunicipalAnalysisEntries(panelLayerId);
  const byTitle = new Map(
    existing.map((entry) => [
      getLocalizedEntryField<string>(entry, "title", locale),
      entry,
    ]),
  );
  const derivedEntries: ContentfulManagementEntry[] = [];

  for (const partition of partitions) {
    const title = getPartitionTitle(panelLayerId, partition.partitionKey);
    const fields = {
      title,
      panelLayerId,
      partitionKey: partition.partitionKey,
      calendarYear: partition.calendarYear,
      territory: partition.territory,
      imageData: partition.imageData,
    };
    const current = byTitle.get(title);
    const entry = current
      ? await patchManagementEntry(current, fields)
      : await createMunicipalAnalysisDraft(fields);
    derivedEntries.push(entry);
  }

  return derivedEntries;
}

function getNextPanelPosition(
  entries: Awaited<ReturnType<typeof listCatalogEntries>>,
  category: string,
  entryId: string,
) {
  const currentPosition = entries.find(
    (entry) => entry.entryId === entryId,
  )?.panelPosition;
  if (typeof currentPosition === "number") {
    return currentPosition;
  }

  const positions = entries
    .filter((entry) => entry.entryId !== entryId && entry.category === category)
    .flatMap((entry) =>
      typeof entry.panelPosition === "number" ? [entry.panelPosition] : [],
    );

  return positions.length > 0
    ? Math.max(...positions) + 1
    : entries.filter((entry) => entry.category === category).length;
}

export async function generateIndexCatalogPreview(
  entryId: string,
  user: AuthenticatedUserSession,
) {
  const current = await getCatalogEntry(entryId);
  assertEditableCatalogEntry(current.item);
  const config = current.item.catalogConfig!;

  try {
    const build = await buildCatalogDraft(config);
    const derivedEntries = await syncMunicipalDrafts(
      config.panelLayerId,
      build.partitions,
    );
    const entries = await listCatalogEntries();
    const readyConfig = withAuditEvent(
      {
        ...config,
        status: "ready",
        validation: build.validation,
        derivedEntryIds: derivedEntries.map((entry) => entry.sys.id),
        updatedBy: {
          uid: user.uid,
          email: user.email,
          at: now(),
        },
      },
      user,
      {
        action: "preview",
        outcome: "success",
      },
    );
    const updated = await patchManagementEntry(
      await getManagementEntry(entryId),
      {
        id: config.panelLayerId,
        name: config.name,
        description: config.description,
        measurementUnit: config.classes.length > 1 ? "classes" : config.unit,
        category: config.category,
        panelPosition: getNextPanelPosition(entries, config.category, entryId),
        timeScale: build.validation.inferred.timeScale,
        imageData: build.panelLayerImageData,
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
        updatedBy: {
          uid: user.uid,
          email: user.email,
          at: now(),
        },
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

function buildCatalogPreviewResponse(
  entry: ContentfulManagementEntry,
  locale: string,
  config: IndexCatalogConfig,
  imageData = getLocalizedEntryField(
    entry,
    "imageData",
    locale,
  ) as IndexCatalogPreview["panelLayer"]["imageData"],
): IndexCatalogPreview {
  if (!config.validation?.valid || !imageData) {
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
      tileApiPath: `/api/index-catalog/drafts/${entry.sys.id}/ee`,
      municipalAnalysisApiPath: `/api/index-catalog/drafts/${entry.sys.id}/municipal-analysis`,
    },
    validation: config.validation,
  };
}

export async function getIndexCatalogPreview(entryId: string) {
  const current = await getCatalogEntry(entryId);
  if (!current.item.catalogManaged) {
    throw new Error("Índice não gerenciado pelo catálogo.");
  }

  return buildCatalogPreviewResponse(
    current.entry,
    current.locale,
    current.item.catalogConfig!,
  );
}

export async function getIndexCatalogDraftMunicipalData(
  entryId: string,
  year: string,
) {
  const current = await getCatalogEntry(entryId);
  const config = current.item.catalogConfig;
  if (!config?.validation?.valid) {
    return null;
  }

  const locale = current.locale;
  const entries = await listMunicipalAnalysisEntries(config.panelLayerId);
  const candidates = entries.map((entry) => ({
    entry,
    partitionKey: getLocalizedEntryField<string>(entry, "partitionKey", locale),
    calendarYear: getLocalizedEntryField<string>(entry, "calendarYear", locale),
  }));
  const exact = candidates.filter(({ partitionKey }) => partitionKey === year);
  const matching = (
    exact.length > 0
      ? exact
      : candidates.filter(
          ({ calendarYear }) => calendarYear === year.slice(0, 4),
        )
  ).map(({ entry }) => entry);

  if (matching.length === 0) {
    return null;
  }

  const patches = matching.flatMap((entry) => {
    const patch = toDatasetPatch(
      getLocalizedEntryField(entry, "imageData", locale),
    );
    return patch ? [patch] : [];
  });
  const imageData = patches.reduce<CompactTerritorialAnalysisDatasetPatch>(
    (current, patch) => ({
      ...current,
      ...patch,
      locations: {
        ...(current.locations ?? {}),
        ...(patch.locations ?? {}),
      },
      templates: {
        ...(current.templates ?? {}),
        ...(patch.templates ?? {}),
      },
      years: {
        ...(current.years ?? {}),
        ...(patch.years ?? {}),
      },
    }),
    {},
  );

  return patches.length > 0
    ? { imageData: imageData as PanelLayerI["imageData"] }
    : null;
}

function assertPublishable(config?: IndexCatalogConfig) {
  if (
    !config ||
    config.status !== "ready" ||
    !config.validation?.valid ||
    !config.derivedEntryIds?.length
  ) {
    throw new Error("Gere e valide a prévia antes de publicar.");
  }
}

export async function publishIndexCatalogDraft(
  entryId: string,
  user: AuthenticatedUserSession,
) {
  const current = await getCatalogEntry(entryId);
  assertEditableCatalogEntry(current.item);
  const config = current.item.catalogConfig;
  assertPublishable(config);
  const publishableConfig = config!;

  try {
    // Rebuild performs the Drive modifiedTime and Earth Engine checks again.
    const build = await buildCatalogDraft(publishableConfig);
    if (
      build.validation.sourceFingerprint !==
      publishableConfig.validation!.sourceFingerprint
    ) {
      throw new Error("A definição mudou desde a última prévia.");
    }

    const refreshedDerived = await syncMunicipalDrafts(
      publishableConfig.panelLayerId,
      build.partitions,
    );
    const refreshedIds = new Set(refreshedDerived.map((entry) => entry.sys.id));
    const staleDerived = (
      await listMunicipalAnalysisEntries(publishableConfig.panelLayerId)
    ).filter((entry) => !refreshedIds.has(entry.sys.id));
    for (const entry of staleDerived) {
      await unpublishManagementEntry(entry);
    }
    for (const entry of refreshedDerived) {
      await publishManagementEntry(entry);
    }

    const publishedConfig = withAuditEvent(
      {
        ...publishableConfig,
        status: "published",
        validation: build.validation,
        derivedEntryIds: refreshedDerived.map((entry) => entry.sys.id),
        updatedBy: {
          uid: user.uid,
          email: user.email,
          at: now(),
        },
      },
      user,
      {
        action: "publish",
        outcome: "success",
      },
    );
    const latestPanelLayer = await patchManagementEntry(
      await getManagementEntry(entryId),
      {
        imageData: build.panelLayerImageData,
        catalogConfig: publishedConfig,
      },
    );
    const published = await publishManagementEntry(latestPanelLayer);

    return {
      entryId: published.sys.id,
      panelLayerId: publishableConfig.panelLayerId,
      status: "published" as const,
    };
  } catch (error) {
    const failedConfig = withAuditEvent(
      {
        ...publishableConfig,
        status: "ready",
        updatedBy: {
          uid: user.uid,
          email: user.email,
          at: now(),
        },
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

function lifecycleEntryTitle(
  entry: ContentfulManagementEntry,
  locale: string,
) {
  return (
    getLocalizedEntryField<string>(entry, "title", locale) ??
    entry.sys.id
  );
}

export async function getIndexCatalogLifecycleImpact(
  entryId: string,
): Promise<IndexCatalogLifecycleImpact> {
  const current = await getCatalogEntry(entryId);
  if (!current.item.panelLayerId) {
    throw new Error("O índice não possui ID técnico e não pode ser gerenciado.");
  }

  const [municipalAnalysis, municipalReportSeries] = await Promise.all([
    listMunicipalAnalysisEntries(current.item.panelLayerId),
    listMunicipalReportSeriesEntries(current.item.panelLayerId),
  ]);
  const linkedEntries = [
    ...municipalAnalysis.map((entry) => ({
      entryId: entry.sys.id,
      contentType: "municipalAnalysis" as const,
      title: lifecycleEntryTitle(entry, current.locale),
      published: Boolean(entry.sys.publishedAt),
    })),
    ...municipalReportSeries.map((entry) => ({
      entryId: entry.sys.id,
      contentType: "municipalReportSeries" as const,
      title: lifecycleEntryTitle(entry, current.locale),
      published: Boolean(entry.sys.publishedAt),
    })),
  ];

  return {
    item: current.item,
    linkedEntries,
    counts: {
      panelLayer: 1,
      municipalAnalysis: municipalAnalysis.length,
      municipalReportSeries: municipalReportSeries.length,
      total: linkedEntries.length + 1,
    },
  };
}

export async function publishIndexCatalogEntry(
  entryId: string,
  user: AuthenticatedUserSession,
) {
  let current = await getCatalogEntry(entryId);
  if (current.item.published) {
    return {
      entryId,
      panelLayerId: current.item.panelLayerId,
      status: "published" as const,
    };
  }

  if (current.item.catalogManaged) {
    const config = current.item.catalogConfig!;
    if (config.status === "published" && config.validation?.valid) {
      await patchManagementEntry(current.entry, {
        catalogConfig: {
          ...config,
          status: "ready",
          updatedBy: {
            uid: user.uid,
            email: user.email,
            at: now(),
          },
        },
      });
      current = await getCatalogEntry(entryId);
    }

    return publishIndexCatalogDraft(current.item.entryId, user);
  }

  const published = await publishManagementEntry(current.entry);
  console.info("Ciclo de vida do catálogo", {
    action: "publish",
    outcome: "success",
    entryId,
    panelLayerId: current.item.panelLayerId,
    uid: user.uid,
    email: user.email,
    at: now(),
  });

  return {
    entryId: published.sys.id,
    panelLayerId: current.item.panelLayerId,
    status: "published" as const,
  };
}

export async function unpublishIndexCatalogEntry(
  entryId: string,
  user: AuthenticatedUserSession,
) {
  const current = await getCatalogEntry(entryId);
  if (!current.item.published) {
    return {
      entryId,
      panelLayerId: current.item.panelLayerId,
      status: current.item.status,
    };
  }

  let entry = current.entry;
  let status: IndexCatalogConfig["status"] | "legacy" = "legacy";
  if (current.item.catalogConfig) {
    const config = current.item.catalogConfig;
    status =
      config.validation?.valid && config.derivedEntryIds?.length
        ? "ready"
        : "draft";
    entry = await patchManagementEntry(entry, {
      catalogConfig: withAuditEvent(
        {
          ...config,
          status,
          updatedBy: {
            uid: user.uid,
            email: user.email,
            at: now(),
          },
        },
        user,
        {
          action: "unpublish",
          outcome: "success",
        },
      ),
    });
  }

  await unpublishManagementEntry(entry);
  console.info("Ciclo de vida do catálogo", {
    action: "unpublish",
    outcome: "success",
    entryId,
    panelLayerId: current.item.panelLayerId,
    uid: user.uid,
    email: user.email,
    at: now(),
  });

  return {
    entryId,
    panelLayerId: current.item.panelLayerId,
    status,
  };
}

async function deleteEntryCompletely(entry: ContentfulManagementEntry) {
  if (entry.sys.publishedAt) {
    await unpublishManagementEntry(entry);
    entry = await getManagementEntry(entry.sys.id);
  }
  await deleteManagementEntry(entry);
}

async function runWithConcurrency<T>(
  values: T[],
  task: (value: T) => Promise<void>,
  concurrency = 4,
) {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      for (;;) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= values.length) return;
        await task(values[index]);
      }
    },
  );
  await Promise.all(workers);
}

export async function deleteIndexCatalogEntry(
  entryId: string,
  confirmation: string,
  user: AuthenticatedUserSession,
) {
  const current = await getCatalogEntry(entryId);
  const panelLayerId = current.item.panelLayerId;
  if (!panelLayerId || confirmation.trim() !== panelLayerId) {
    throw new Error(
      "Confirme a remoção informando exatamente o ID técnico do índice.",
    );
  }

  // Remove a chave de ativação primeiro; uma falha parcial nunca deixa o
  // Monitoramento apontando para partições incompletas.
  if (current.entry.sys.publishedAt) {
    await unpublishManagementEntry(current.entry);
  }

  const [municipalAnalysis, municipalReportSeries] = await Promise.all([
    listMunicipalAnalysisEntries(panelLayerId),
    listMunicipalReportSeriesEntries(panelLayerId),
  ]);
  const linkedEntries = [...municipalAnalysis, ...municipalReportSeries];
  await runWithConcurrency(linkedEntries, deleteEntryCompletely);
  await deleteEntryCompletely(await getManagementEntry(entryId));

  console.info("Ciclo de vida do catálogo", {
    action: "delete",
    outcome: "success",
    entryId,
    panelLayerId,
    deletedEntries: linkedEntries.length + 1,
    uid: user.uid,
    email: user.email,
    at: now(),
  });

  return {
    entryId,
    panelLayerId,
    status: "deleted" as const,
    deletedEntries: linkedEntries.length + 1,
  };
}

export function getCatalogValidationFromError(
  error: unknown,
): CatalogValidationReport | null {
  return getCatalogBuildValidation(error);
}
