import {
  catalogErrorResponse,
  noStoreJson,
  readJsonBody,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";
import {
  getIndexCatalogPresentationPreview,
  updateIndexCatalogPresentation,
} from "@/services/indexCatalog/presentationService";

interface PresentationRouteContext {
  params: Promise<{ entryId: string }>;
}

/** Como o índice legado adotado está agora, para o mapa e o texto da prévia. */
export async function GET(request: Request, context: PresentationRouteContext) {
  const access = await requireCatalogAccess(request);
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    return noStoreJson(
      await getIndexCatalogPresentationPreview(decodeURIComponent(entryId)),
    );
  } catch (error) {
    return catalogErrorResponse(error);
  }
}

export async function PUT(request: Request, context: PresentationRouteContext) {
  const access = await requireCatalogAccess(request, { mutation: true });
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    const result = await updateIndexCatalogPresentation(
      decodeURIComponent(entryId),
      await readJsonBody(request),
      access.user,
    );
    // Nenhum cache público é invalidado aqui: a escrita fica na versão de
    // rascunho da entry e a plataforma lê a publicada. Quem invalida é a rota
    // de ciclo de vida, quando o operador publica.
    return noStoreJson(result);
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
