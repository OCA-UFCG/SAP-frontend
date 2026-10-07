import {
  catalogErrorResponse,
  noStoreJson,
  readJsonBody,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";
import {
  getIndexCatalogAppearance,
  updateIndexCatalogAppearance,
} from "@/services/indexCatalog/legacyAppearanceService";

interface AppearanceRouteContext {
  params: Promise<{ entryId: string }>;
}

/** Os rótulos, as cores e os limites que o índice legado tem hoje. */
export async function GET(request: Request, context: AppearanceRouteContext) {
  const access = await requireCatalogAccess(request);
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    return noStoreJson(
      await getIndexCatalogAppearance(decodeURIComponent(entryId)),
    );
  } catch (error) {
    return catalogErrorResponse(error);
  }
}

/**
 * Grava a aparência editada.
 *
 * O corpo carrega apenas as linhas e os limites; o servidor relê o `imageData`
 * gravado e aplica a alteração em cima dele, para que os valores territoriais
 * do índice não trafeguem pelo navegador. Nenhum cache público é invalidado
 * aqui — a escrita fica na versão de rascunho, e quem invalida é a rota de
 * ciclo de vida quando o operador publica.
 */
export async function PUT(request: Request, context: AppearanceRouteContext) {
  const access = await requireCatalogAccess(request, { mutation: true });
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    return noStoreJson(
      await updateIndexCatalogAppearance(
        decodeURIComponent(entryId),
        await readJsonBody(request),
        access.user,
      ),
    );
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
