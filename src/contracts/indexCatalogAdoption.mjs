/**
 * Contrato da adoção de um índice legado pelo catálogo.
 *
 * Mora aqui, e não dentro do serviço, porque duas coisas precisam produzir
 * exatamente o mesmo `catalogConfig`: o botão "Adotar no catálogo" da tela
 * (`src/services/indexCatalog/legacyAdoption.ts`) e a adoção em lote de
 * `tools/drive-contentful-pipeline/contentful-adopt-legacy-indices.mjs`, que é Node puro e não
 * consegue importar um módulo `server-only`. Se as duas divergirem, metade dos
 * legados nasce com um formato de configuração e metade com outro.
 *
 * O que a adoção grava é deliberadamente inerte: só `catalogConfig`, nunca
 * `imageData`, `statisticsSource` ou as partições `municipalAnalysis` de onde
 * os valores de um legado vêm.
 */

export const INDEX_CATALOG_CATEGORIES = [
  "Dados Climáticos",
  "Dados Ambientais",
  "Dados Socioeconômicos",
];

/**
 * O histórico de auditoria é cortado porque vive dentro de um campo Object da
 * entry: sem limite, uma entry muito editada cresce até o teto de tamanho do
 * Contentful e passa a recusar qualquer escrita do catálogo.
 */
const CATALOG_AUDIT_LOG_LIMIT = 50;

/** Toda escrita no catálogo deixa rastro de quem fez, quando e com que efeito. */
export function appendCatalogAuditEvent(config, event) {
  return {
    ...config,
    auditLog: [...(config.auditLog ?? []), event].slice(
      -CATALOG_AUDIT_LOG_LIMIT,
    ),
  };
}

/**
 * A categoria de um legado sempre é uma das três do catálogo na base atual; o
 * fallback existe para uma entry incompleta não impedir a adoção, e o
 * formulário obriga o operador a escolher antes de republicar.
 */
export function resolveAdoptedCategory(category) {
  return (
    INDEX_CATALOG_CATEGORIES.find((entry) => entry === category) ??
    INDEX_CATALOG_CATEGORIES[0]
  );
}

/**
 * Monta o `catalogConfig` de um legado adotado no escopo de apresentação, a
 * partir do que já está gravado na própria entry.
 *
 * `status` acompanha a publicação real da entry: um legado publicado é adotado
 * como `published`, senão a tela pediria para publicar de novo um índice que
 * já está no ar.
 *
 * @example
 * buildAdoptedPresentationConfig({
 *   item: { panelLayerId: "deg", name: "Índice de Degradação", published: true },
 *   actor: { uid: "abc", email: "oca@gmail.com" },
 *   at: "2026-09-04T12:00:00.000Z",
 * }); // => { schemaVersion: 2, managedScope: "presentation", ... }
 */
export function buildAdoptedPresentationConfig({
  item,
  reportConfig,
  actor,
  at,
}) {
  const author = { uid: actor.uid, email: actor.email ?? null, at };

  return appendCatalogAuditEvent(
    {
      schemaVersion: 2,
      managedScope: "presentation",
      panelLayerId: item.panelLayerId,
      status: item.published ? "published" : "draft",
      name: item.name,
      description: item.description,
      category: resolveAdoptedCategory(item.category),
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
          ? { previousSchemaVersion: 1 }
          : {}),
      },
    },
    { action: "adopt", outcome: "success", ...author },
  );
}

/**
 * Monta o `catalogConfig` de um legado adotado no momento em que ele é
 * publicado.
 *
 * Mora aqui pela mesma razão da adoção: o botão "Publicar" do editor
 * (`src/services/indexCatalog/presentationService.ts`) e a publicação em lote
 * de `tools/drive-contentful-pipeline/contentful-publish-adopted-legacy.mjs`
 * precisam deixar o mesmo rastro. Nada do conteúdo é reescrito — o que a tela
 * editou já foi gravado antes; aqui só se registra quem publicou e quando.
 *
 * @example
 * buildPublishedPresentationConfig({
 *   config: adopted,
 *   actor: { uid: "abc", email: "oca@gmail.com" },
 *   at: "2026-09-04T12:00:00.000Z",
 * }); // => { ...adopted, status: "published", auditLog: [..., { action: "publish" }] }
 */
export function buildPublishedPresentationConfig({ config, actor, at }) {
  const author = { uid: actor.uid, email: actor.email ?? null, at };

  return appendCatalogAuditEvent(
    { ...config, status: "published", updatedBy: author },
    { action: "publish", outcome: "success", ...author },
  );
}
