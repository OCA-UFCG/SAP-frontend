/**
 * Tag do Data Cache do Next para as queries de `panelLayer`.
 * `clearPanelLayersCache` só limpa a memoização deste processo; a resposta do
 * Contentful continua no Data Cache por até `revalidate` segundos e é
 * compartilhada por todas as rotas. Uma entrada criada por `/api/ee` não é
 * invalidada por `revalidatePath("/[locale]/platform")`, então sem a tag um
 * índice recém-publicado podia ficar até uma hora fora da lista que o mapa usa.
 */
export const PANEL_LAYERS_CACHE_TAG = "panel-layers";
