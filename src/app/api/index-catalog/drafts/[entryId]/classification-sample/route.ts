import {
  catalogErrorResponse,
  noStoreJson,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";
import { getIndexCatalogDraftClassificationSample } from "@/services/indexCatalog/indexCatalogService";

const YEAR_PATTERN = /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/u;

interface DraftClassificationRouteContext {
  params: Promise<{ entryId: string }>;
}

/**
 * A distribuição de valores de um rascunho num período, para o formulário
 * calcular os limites das faixas por um método de classificação.
 *
 * Devolve a amostra e não os limites já prontos porque o operador experimenta:
 * trocar de método, de quantidade de faixas ou do tamanho do intervalo é
 * instantâneo no navegador, e cada tentativa custaria uma leitura do Earth
 * Engine se o cálculo morasse aqui.
 */
export async function GET(
  request: Request,
  context: DraftClassificationRouteContext,
) {
  const access = await requireCatalogAccess(request);
  if ("response" in access) return access.response;

  try {
    const year = new URL(request.url).searchParams.get("year")?.trim() ?? "";
    if (!YEAR_PATTERN.test(year)) {
      throw new Error(`Período inválido: ${year || "(vazio)"}.`);
    }

    const { entryId } = await context.params;
    const sample = await getIndexCatalogDraftClassificationSample(
      decodeURIComponent(entryId),
      year,
    );

    if (!sample) {
      return noStoreJson(
        {
          error:
            "Este índice não tem de onde ler valores: o mapa vem de uma FeatureCollection sem tabela de valor por município, então não há distribuição a classificar.",
        },
        404,
      );
    }

    return noStoreJson({ sample });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
