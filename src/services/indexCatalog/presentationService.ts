import "server-only";

import { buildPublishedPresentationConfig } from "@/contracts/indexCatalogAdoption.mjs";
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
} from "@/services/indexCatalog/contentfulManagement";
import { readCompactImageData } from "@/services/indexCatalog/presentationImageData";
import { preparePanelPositionForPublish } from "@/services/indexCatalog/panelPositionPublication";
import { getIndexCatalogPreviewMapUrl } from "@/services/indexCatalog/previewMapService";
import {
  isPresentationManagedCatalogConfig,
  type IndexCatalogPresentationPreview,
} from "@/types/indexCatalog";
import { parseIndexCatalogPresentationInput } from "@/utils/indexCatalog";
import { getDocTemplate } from "@/services/buildDoc/buildDocTemplate";

/**
 * Grava a apresentação de um índice legado adotado.
 *
 * Só escreve campos que já moravam na entry, e nunca `imageData` nem
 * `statisticsSource`: os valores territoriais do índice continuam vindo das
 * partições `municipalAnalysis` ou do registro estático, e reescrever qualquer
 * um dos dois mudaria os números em vez da apresentação. Rótulos e cores, que
 * moram dentro do `imageData`, têm escrita própria em
 * `legacyAppearanceService` justamente porque ela precisa de uma guarda que
 * esta não precisa. Também não derruba nenhum `status` de validação, porque não
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

  // A posição fica só no `catalogConfig` aqui: o campo `panelPosition` da entry
  // é escrito na publicação, que é onde a troca com o índice que já ocupava a
  // posição pode ser aplicada nas duas entries de uma vez.
  const updated = await patchManagementEntry(current.entry, {
    name: input.name,
    description: input.description,
    category: input.category,
    measurementUnit: input.measurementUnit,
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
 * Não regrava o conteúdo antes de publicar: o que a tela editou já foi gravado
 * pelo salvamento, pela captura da imagem ou pela rota de texto. A exceção é a
 * posição na categoria, que é aplicada aqui para poder trocar de lugar com o
 * índice que já estava nela. Publicar é levar a versão de rascunho da entry
 * para o ar, e a conferência de
 * `sys.publishedAt` existe pelo mesmo motivo do escopo completo — uma
 * publicação que não se registra tem de virar erro, não mensagem de sucesso.
 */
export async function publishIndexCatalogPresentation(
  entryId: string,
  user: AuthenticatedUserSession,
) {
  const current = await getCatalogEntry(entryId);
  const config = requirePresentationConfig(current);
  const publishedConfig = buildPublishedPresentationConfig({
    config,
    actor: user,
    at: catalogTimestamp(),
  });
  const position = await preparePanelPositionForPublish({
    entryId,
    entry: current.entry,
    locale: current.locale,
    category: config.category,
    requestedPosition: config.panelPosition,
    user,
  });
  const patched = await patchManagementEntry(current.entry, {
    panelPosition: position.position,
    catalogConfig: publishedConfig,
  });
  const published = await publishManagementEntry(patched);
  if (!published.sys.publishedAt) {
    throw new Error(
      `O Contentful não confirmou a publicação da entry ${entryId}: sys.publishedAt ausente. O índice continuaria com a versão anterior no Monitoramento.`,
    );
  }

  const positionNote = await position.applySwap();
  return {
    entryId: published.sys.id,
    panelLayerId: config.panelLayerId,
    status: "published" as const,
    ...(positionNote ? { positionNote } : {}),
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
