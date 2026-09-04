import {
  catalogErrorResponse,
  noStoreJson,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";
import { readIndexCatalogDocsText } from "@/services/indexCatalog/presentationService";

interface DocsTextRouteContext {
  params: Promise<{ entryId: string }>;
}

/**
 * O texto que o índice tem hoje no Google Docs, sem variáveis trocadas, para o
 * formulário abrir com o texto real em vez de um campo vazio.
 */
export async function GET(request: Request, context: DocsTextRouteContext) {
  const access = await requireCatalogAccess(request);
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    return noStoreJson(
      await readIndexCatalogDocsText(decodeURIComponent(entryId)),
    );
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
