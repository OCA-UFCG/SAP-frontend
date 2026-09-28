import "server-only";

import type { AuthenticatedUserSession } from "@/lib/server-session";
import { isMunicipalSpreadsheetSource } from "@/contracts/municipalSpreadsheet";
import {
  buildSpreadsheetYearPatch,
  selectMunicipalSpreadsheetValues,
} from "@/repositories/platform/municipalSpreadsheetRepository";
import { getDraftSpreadsheetSnapshot } from "@/services/indexCatalog/draftSpreadsheetSnapshot";
import { readDraftClassificationSample } from "@/services/indexCatalog/classificationSampleReader";
import { publishSpreadsheetSnapshot } from "@/services/indexCatalog/spreadsheetSnapshotStorage";
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
  requireFullyManagedConfig,
  requireManagedConfig,
  withAuditEvent,
} from "@/services/indexCatalog/catalogConfigAudit";
import { preparePanelPositionForPublish } from "@/services/indexCatalog/panelPositionPublication";
import { getIndexCatalogPreviewMapUrl } from "@/services/indexCatalog/previewMapService";
import { publishIndexCatalogPresentation } from "@/services/indexCatalog/presentationService";
import {
  isFullyManagedCatalogConfig,
  isPresentationManagedCatalogConfig,
  type CatalogValidationReport,
  type IndexCatalogBuildResult,
  type IndexCatalogConfigV2,
  type IndexCatalogItem,
  type IndexCatalogDraftInput,
  type IndexCatalogLifecycleImpact,
  type IndexCatalogPreview,
} from "@/types/indexCatalog";
import {
  catalogLayerClassCount,
  createCatalogPanelLayerId,
  hasPublishableValidation,
  makeUniqueCatalogPanelLayerId,
  parseIndexCatalogDraftInput,
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

/**
 * A unidade que o painel de análise mostra ao lado do valor.
 *
 * Uma tabela classificatória é sempre percentual — cada classe ocupa uma fatia
 * da área —, mas um índice de valor único tem a unidade do próprio indicador:
 * "registros", "pessoas", "%".
 */
function resolveMeasurementUnit(input: {
  valueIndicator?: { measurementUnit: string };
}) {
  return input.valueIndicator?.measurementUnit ?? "%";
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
    measurementUnit: resolveMeasurementUnit(input),
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
  // O escopo é conferido antes de validar o corpo: um legado adotado enviado
  // para esta rota tem de ouvir que ela não é dele, e não "Categoria inválida".
  const current = await getCatalogEntry(entryId);
  const previous = requireFullyManagedConfig(current);
  const input = parseIndexCatalogDraftInput(rawInput);
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
    measurementUnit: resolveMeasurementUnit(input),
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
  const config = requireFullyManagedConfig(current);

  try {
    const build = await buildCatalogDraft(config);
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
        measurementUnit: resolveMeasurementUnit(config),
        category: config.category,
        // A prévia não mexe na ordem do Monitoramento de propósito: o campo
        // `panelPosition` é escrito na publicação, que é onde a troca com o
        // índice que já ocupava a posição pode ser aplicada nas duas entries.
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
  const config = requireFullyManagedConfig(current);
  return buildCatalogPreviewResponse(current.entry, current.locale, config);
}

export async function getIndexCatalogDraftMunicipalData(
  entryId: string,
  year: string,
  locationKey: string,
) {
  const current = await getCatalogEntry(entryId);
  const config = requireFullyManagedConfig(current);
  if (!config.validation?.valid || !config.validatedStatisticsSource) {
    return null;
  }

  // Um índice de planilha não passa pelo Earth Engine: a prévia lê a própria
  // planilha, guardada em memória pela validação. O asset publicado fica fora
  // disso de propósito — ele pertence à versão que está no ar, e um rascunho
  // que o lesse mostraria os valores antigos como se fossem os novos.
  if (isMunicipalSpreadsheetSource(config.validatedStatisticsSource)) {
    const snapshot = await getDraftSpreadsheetSnapshot(
      config.validatedStatisticsSource,
    );
    return {
      imageData: buildSpreadsheetYearPatch(snapshot, year, locationKey),
    };
  }

  const result = await getGeeStatisticsYearPatch(
    config.panelLayerId,
    year,
    locationKey,
    catalogLayerClassCount(config.validatedStatisticsSource, config.classes),
    config.validatedStatisticsSource,
    // A prévia do catálogo reusa o painel de análise, então ela dispara um
    // pedido por período do rascunho. Passar os períodos já inferidos na
    // validação faz essa tela custar uma leitura do Earth Engine em vez de uma
    // por ano — é onde a espera mais incomoda, porque é onde se publica.
    config.validation.inferred.periods,
  );
  return result ? { imageData: result.patch } : null;
}

/**
 * Os valores municipais de um rascunho de planilha, para a coropleta da prévia.
 *
 * Devolve `null` quando o índice não vem de planilha: nas demais formas o mapa
 * da prévia é um tile do Earth Engine, servido por `drafts/[entryId]/ee`.
 */
export async function getIndexCatalogDraftChoroplethValues(
  entryId: string,
  year: string,
) {
  const current = await getCatalogEntry(entryId);
  const config = requireFullyManagedConfig(current);
  if (!isMunicipalSpreadsheetSource(config.validatedStatisticsSource)) {
    return null;
  }
  const snapshot = await getDraftSpreadsheetSnapshot(
    config.validatedStatisticsSource,
  );
  return selectMunicipalSpreadsheetValues(snapshot, year);
}

/**
 * A distribuição de valores de um rascunho num período, para a tela calcular os
 * limites das faixas por um método de classificação.
 *
 * Fica numa leitura própria, e não junto da validação, porque o operador troca
 * de método e de quantidade de faixas várias vezes seguidas: a amostra é lida
 * uma vez e todos os métodos rodam sobre ela no navegador.
 */
export async function getIndexCatalogDraftClassificationSample(
  entryId: string,
  year: string,
) {
  const current = await getCatalogEntry(entryId);
  const config = requireFullyManagedConfig(current);
  return readDraftClassificationSample(config, year);
}

/**
 * Publicar exige uma prévia válida gravada — e é isso que se confere, não o
 * `status` sozinho.
 *
 * Um índice já publicado tem `status: "published"`, e exigir `"ready"` tornava
 * impossível republicá-lo: corrigir o texto do relatório ou recapturar a imagem
 * do cartão grava na versão de rascunho de propósito, sem tocar na validação,
 * e a publicação dessa correção caía aqui com "Revalide os assets" mesmo com a
 * prévia intacta. `draft` e `error` continuam recusados porque nos dois a
 * validação foi apagada ou marcada inválida, e a conferência que realmente
 * protege o índice público segue sendo a impressão digital reconferida em
 * `publishIndexCatalogDraft`.
 *
 * A regra de status é `hasPublishableValidation`, compartilhada com a tela: é
 * ela que decide se o botão "Republicar" aparece, e as duas separadas deixariam
 * um botão visível para um estado que esta função recusa.
 */
/**
 * A fonte estatística que vai para a entry publicada.
 *
 * Para toda forma vinda do Earth Engine ela é a própria saída da validação; só
 * a planilha precisa de uma escrita, porque os seus valores não moram num asset
 * do GEE e sim num arquivo JSON que este é o momento de gravar.
 */
async function storePublishedStatisticsSource(
  panelLayerId: string,
  build: IndexCatalogBuildResult,
) {
  if (
    !isMunicipalSpreadsheetSource(build.statisticsSource) ||
    !build.spreadsheetSnapshot
  ) {
    return build.statisticsSource;
  }
  return publishSpreadsheetSnapshot(
    panelLayerId,
    build.spreadsheetSnapshot,
    build.statisticsSource,
  );
}

function assertPublishable(config: IndexCatalogConfigV2) {
  if (
    !hasPublishableValidation(config.status) ||
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
  const config = requireFullyManagedConfig(current);
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
    // Só aqui, com a publicação já decidida, o índice de planilha escreve no
    // Contentful. Antes da conferência acima, uma publicação recusada teria
    // trocado o arquivo que a produção lê.
    const statisticsSource = await storePublishedStatisticsSource(
      config.panelLayerId,
      build,
    );
    const position = await preparePanelPositionForPublish({
      entryId,
      entry: current.entry,
      locale: current.locale,
      category: config.category,
      requestedPosition: config.panelPosition,
      user,
    });
    const publishedConfig = withAuditEvent(
      {
        ...config,
        classes: build.classes,
        status: "published",
        validation: build.validation,
        validatedStatisticsSource: statisticsSource,
        updatedBy: { uid: user.uid, email: user.email, at: catalogTimestamp() },
      },
      user,
      { action: "publish", outcome: "success" },
    );
    const latestPanelLayer = await patchManagementEntry(
      await getManagementEntry(entryId),
      {
        panelPosition: position.position,
        imageData: build.panelLayerImageData,
        statisticsSource,
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
    const positionNote = await position.applySwap();
    return {
      entryId: published.sys.id,
      panelLayerId: config.panelLayerId,
      status: "published" as const,
      ...(positionNote ? { positionNote } : {}),
    };
  } catch (error) {
    // O `status` fica como estava antes da tentativa — o spread de `config` o
    // preserva de propósito. Escrever `"ready"` aqui era certo enquanto
    // publicar só podia partir de `"ready"`; numa republicação ele parte de
    // `"published"`, e rebaixá-lo diria que o índice saiu do ar quando a
    // versão publicada continua no Monitoramento.
    const failedConfig = withAuditEvent(
      {
        ...config,
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
  // A mesma regra da remoção: esta é a tela que a confirma.
  requireDeletablePanelLayerId(current.item);
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
  // Um legado adotado não tem assets a revalidar: publicar é levar ao ar a
  // versão de rascunho da entry, com o texto e a imagem que já foram gravados.
  return isPresentationManagedCatalogConfig(config)
    ? publishIndexCatalogPresentation(entryId, user)
    : publishIndexCatalogDraft(entryId, user);
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

/**
 * O catálogo remove a entry de um índice que ele mesmo criou, ou de um rascunho
 * que nunca foi publicado. Um legado que já esteve no ar é diferente: o
 * `panelLayer` dele é a única cópia da configuração de um índice cujos valores
 * moram nas partições `municipalAnalysis`, e apagá-lo tiraria o índice da
 * plataforma sem nada para reconstruí-lo.
 */
function assertDeletable(item: IndexCatalogItem) {
  if (!item.everPublished) return;

  if (isPresentationManagedCatalogConfig(item.catalogConfig)) {
    throw new Error(
      `${item.panelLayerId} é um índice legado que já foi publicado: o catálogo gerencia a apresentação dele, mas não remove a entry. Use “Despublicar” para tirá-lo do Monitoramento.`,
    );
  }
  if (!isFullyManagedCatalogConfig(item.catalogConfig)) {
    throw new Error(
      `${item.panelLayerId} já foi publicado e não é gerenciado pelo catálogo, então o catálogo não remove a entry dele.`,
    );
  }
}

/**
 * O ID técnico que a remoção confere, para qualquer entry que o catálogo possa
 * remover. Vem do item, e não do `catalogConfig`, porque uma entry que nunca
 * foi publicada pode ser removida sem ter sido adotada — é o caso dos rascunhos
 * de teste com `catalogConfig` v1, que de outra forma ficariam sem nenhuma ação
 * disponível na tela.
 */
function requireDeletablePanelLayerId(item: IndexCatalogItem) {
  assertDeletable(item);
  if (!item.panelLayerId.trim()) {
    throw new Error(
      `A entry ${item.entryId} não tem o campo id preenchido, então não há ID técnico para confirmar a remoção.`,
    );
  }
  return item.panelLayerId;
}

export async function deleteIndexCatalogEntry(
  entryId: string,
  confirmation: string,
  user: AuthenticatedUserSession,
) {
  const current = await getCatalogEntry(entryId);
  const panelLayerId = requireDeletablePanelLayerId(current.item);
  if (confirmation.trim() !== panelLayerId) {
    throw new Error(
      "Confirme a remoção informando exatamente o ID técnico do índice.",
    );
  }
  await deleteEntryCompletely(current.entry);
  console.info("Ciclo de vida do catálogo", {
    action: "delete",
    outcome: "success",
    entryId,
    panelLayerId,
    deletedEntries: 1,
    uid: user.uid,
    email: user.email,
    at: catalogTimestamp(),
  });
  return {
    entryId,
    panelLayerId,
    status: "deleted" as const,
    deletedEntries: 1,
  };
}

export function getCatalogValidationFromError(
  error: unknown,
): CatalogValidationReport | null {
  return getCatalogBuildValidation(error);
}
