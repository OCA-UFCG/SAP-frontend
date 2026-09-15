/**
 * Contrato do `catalogConfig` dos índices legados que o catálogo já adotou.
 *
 * Mora aqui, e não dentro do serviço, porque a tela e a publicação em lote de
 * `tools/drive-contentful-pipeline/contentful-publish-adopted-legacy.mjs` — que
 * é Node puro e não consegue importar um módulo `server-only` — precisam
 * deixar exatamente o mesmo rastro. Se as duas divergirem, metade dos legados
 * grava um formato de configuração e metade grava outro.
 *
 * A adoção de novos legados não existe mais: o catálogo deixou de listar
 * `panelLayer` fora dele quando sobraram apenas entradas de teste, e os que já
 * foram adotados continuam sendo editados pelo escopo de apresentação.
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
