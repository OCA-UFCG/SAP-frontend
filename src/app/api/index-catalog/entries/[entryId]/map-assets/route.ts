import {
  catalogErrorResponse,
  noStoreJson,
  readJsonBody,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";
import {
  getIndexCatalogMapAssets,
  updateIndexCatalogMapAssets,
} from "@/services/indexCatalog/legacyMapAssetsService";

interface MapAssetsRouteContext {
  params: Promise<{ entryId: string }>;
}

/** Os assets do Earth Engine que desenham o mapa deste legado hoje. */
export async function GET(request: Request, context: MapAssetsRouteContext) {
  const access = await requireCatalogAccess(request);
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    return noStoreJson(
      await getIndexCatalogMapAssets(decodeURIComponent(entryId)),
    );
  } catch (error) {
    return catalogErrorResponse(error);
  }
}

/**
 * Grava os assets trocados.
 *
 * O corpo carrega apenas pares período/asset; o servidor relê o `imageData`
 * gravado e aplica a troca em cima dele, para que os valores territoriais do
 * índice não trafeguem pelo navegador. Nenhum cache público é invalidado aqui —
 * a escrita fica na versão de rascunho, e quem invalida é a rota de ciclo de
 * vida quando o operador publica.
 */
export async function PUT(request: Request, context: MapAssetsRouteContext) {
  const access = await requireCatalogAccess(request, { mutation: true });
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    return noStoreJson(
      await updateIndexCatalogMapAssets(
        decodeURIComponent(entryId),
        await readJsonBody(request),
        access.user,
      ),
    );
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
