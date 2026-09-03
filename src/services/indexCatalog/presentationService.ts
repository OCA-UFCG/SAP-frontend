import "server-only";

import type { AuthenticatedUserSession } from "@/lib/server-session";
import {
  catalogTimestamp,
  requireManagedConfig,
  requirePresentationConfig,
  withAuditEvent,
} from "@/services/indexCatalog/catalogConfigAudit";
import {
  getCatalogEntry,
  getLocalizedEntryField,
  patchManagementEntry,
  publishManagementEntry,
  type ContentfulManagementEntry,
} from "@/services/indexCatalog/contentfulManagement";
import { getIndexCatalogPreviewMapUrl } from "@/services/indexCatalog/previewMapService";
import {
  isPresentationManagedCatalogConfig,
  type IndexCatalogPresentationPreview,
} from "@/types/indexCatalog";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";
import { isCompactImageData } from "@/utils/imageData";
import type { ImageDataConfig } from "@/utils/interfaces";
import { parseIndexCatalogPresentationInput } from "@/utils/indexCatalog";
import { getDocTemplate } from "@/services/buildDoc/buildDocTemplate";

function readCompactImageData(
  entry: ContentfulManagementEntry,
  locale: string,
  panelLayerId: string,
): CompactTerritorialAnalysisDataset {
  const imageData = getLocalizedEntryField<ImageDataConfig>(
    entry,
    "imageData",
    locale,
  );
  if (!isCompactImageData(imageData)) {
    throw new Error(
      `O imageData de ${panelLayerId} não está no formato territorial-compact, então o catálogo não consegue desenhar o mapa nem descobrir os períodos dele.`,
    );
  }
  return imageData;
}

/**
 * Grava a apresentação de um índice legado adotado.
 *
 * Só escreve campos que já moravam na entry, e nunca `imageData`,
 * `statisticsSource` ou `catalogConfig.classes`: os valores territoriais do
 * índice continuam vindo das partições `municipalAnalysis` ou do registro
 * estático, e reescrever qualquer um dos três mudaria os números em vez da
 * apresentação. Também não derruba nenhum `status` de validação, porque não
 * existe validação de assets neste escopo.
 *
 * @example
 * await updateIndexCatalogPresentation(entryId, { name, description, category, measurementUnit }, user);
 */
export async function updateIndexCatalogPresentation(
  entryId: string,
  rawInput: unknown,
  user: AuthenticatedUserSession,
) {
  const current = await getCatalogEntry(entryId);
  const previous = requirePresentationConfig(current);
  const input = parseIndexCatalogPresentationInput(rawInput);
  const config = withAuditEvent(
    {
      ...previous,
      ...input,
      updatedBy: { uid: user.uid, email: user.email, at: catalogTimestamp() },
    },
    user,
    { action: "update", outcome: "success" },
  );

  const updated = await patchManagementEntry(current.entry, {
    name: input.name,
    description: input.description,
    category: input.category,
    measurementUnit: input.measurementUnit,
    ...(input.panelPosition === undefined
      ? {}
      : { panelPosition: input.panelPosition }),
    catalogConfig: config,
  });

  return {
    entryId: updated.sys.id,
    panelLayerId: config.panelLayerId,
    managedScope: "presentation" as const,
    status: config.status,
    requiresRepublish: current.item.published,
  };
}

/**
 * Como o índice legado adotado está agora: o mapa do período padrão e a imagem
 * do cartão. Não valida nada porque não há nada a validar — o `imageId` já está
 * publicado no `imageData` e os valores continuam na origem de sempre.
 */
export async function getIndexCatalogPresentationPreview(
  entryId: string,
): Promise<IndexCatalogPresentationPreview> {
  const current = await getCatalogEntry(entryId);
  const config = requirePresentationConfig(current);
  const imageData = readCompactImageData(
    current.entry,
    current.locale,
    config.panelLayerId,
  );
  const previewMapUrl = await getIndexCatalogPreviewMapUrl(
    current.entry,
    current.locale,
  );
  const defaultPeriod =
    imageData.defaultYear ?? Object.keys(imageData.years).at(-1) ?? "";

  return {
    entryId,
    managedScope: "presentation",
    panelLayer: {
      sys: { id: entryId },
      id: config.panelLayerId,
      name: config.name,
      description: config.description,
      category: config.category,
      ...(config.panelPosition === undefined
        ? {}
        : { panelPosition: config.panelPosition }),
      previewMap: previewMapUrl ? { url: previewMapUrl } : null,
      imageData,
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
      timeScale: getLocalizedEntryField<string>(
        current.entry,
        "timeScale",
        current.locale,
      ),
      tileApiPath: `/api/index-catalog/drafts/${entryId}/ee`,
      // `municipalAnalysisApiPath` fica de fora de propósito: sem ele o painel
      // de análise usa a rota de produção do índice, que é a única que sabe ler
      // as partições `municipalAnalysis` deste legado.
    },
    defaultPeriod,
  };
}

/**
 * Publica um índice legado adotado.
 *
 * Não regrava nada antes de publicar: o que a tela editou já foi gravado pelo
 * salvamento, pela captura da imagem ou pela rota de texto. Publicar aqui é
 * levar a versão de rascunho da entry para o ar, e a conferência de
 * `sys.publishedAt` existe pelo mesmo motivo do escopo completo — uma
 * publicação que não se registra tem de virar erro, não mensagem de sucesso.
 */
export async function publishIndexCatalogPresentation(
  entryId: string,
  user: AuthenticatedUserSession,
) {
  const current = await getCatalogEntry(entryId);
  const config = requirePresentationConfig(current);
  const publishedConfig = withAuditEvent(
    {
      ...config,
      status: "published" as const,
      updatedBy: { uid: user.uid, email: user.email, at: catalogTimestamp() },
    },
    user,
    { action: "publish", outcome: "success" },
  );
  const patched = await patchManagementEntry(current.entry, {
    catalogConfig: publishedConfig,
  });
  const published = await publishManagementEntry(patched);
  if (!published.sys.publishedAt) {
    throw new Error(
      `O Contentful não confirmou a publicação da entry ${entryId}: sys.publishedAt ausente. O índice continuaria com a versão anterior no Monitoramento.`,
    );
  }

  return {
    entryId: published.sys.id,
    panelLayerId: config.panelLayerId,
    status: "published" as const,
  };
}

/**
 * A camada que a rota de tiles do catálogo desenha, nos dois escopos.
 *
 * Existe para o mapa da prévia não depender do caminho de validação: um legado
 * adotado nunca terá `validatedStatisticsSource`, mas tem `imageData` com
 * `imageId` por período — que é tudo de que o Earth Engine precisa para
 * devolver um tile.
 */
export async function resolveCatalogPreviewTileLayer(entryId: string) {
  const current = await getCatalogEntry(entryId);
  const config = requireManagedConfig(current);
  if (
    !isPresentationManagedCatalogConfig(config) &&
    (!config.validation?.valid || !config.validatedStatisticsSource)
  ) {
    throw new Error("O rascunho ainda não possui uma prévia válida.");
  }

  return {
    id: config.panelLayerId,
    imageData: readCompactImageData(
      current.entry,
      current.locale,
      config.panelLayerId,
    ),
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
  };
}

/**
 * O texto que este índice tem hoje no Google Docs, pronto para ser editado.
 *
 * Um índice legado nunca tem `reportConfig`: a narrativa dele vive num bloco do
 * documento. Abrir o formulário em branco e salvar substituiria esse texto por
 * nada, então a tela traz o texto do documento para o operador editar o que já
 * está publicado em vez de recomeçar.
 *
 * Nenhuma variável é interpolada de propósito — `getDocTemplate` sem cidade,
 * estado, mês e ano devolve `[municipio]` e `[periodo]` como estão escritos, e
 * é isso que precisa ir para o campo de texto.
 *
 * @example
 * await readIndexCatalogDocsText(entryId); // => { sections: [{ title, text }] }
 */
export async function readIndexCatalogDocsText(entryId: string) {
  const current = await getCatalogEntry(entryId);
  const config = requireManagedConfig(current);
  const template = await getDocTemplate({ themes: [config.panelLayerId] });
  const sections = template[config.panelLayerId] ?? [];

  return {
    panelLayerId: config.panelLayerId,
    sections: sections.map((section) => ({
      title: section.title,
      text: section.text,
    })),
  };
}
