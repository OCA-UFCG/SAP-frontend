import {
  catalogErrorResponse,
  noStoreJson,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";
import { getAmfeSheetTable } from "@/repositories/platform/amfeSheetRepository";
import { collectColumnValues } from "@/repositories/platform/amfeSheetTable";

/**
 * As colunas que a planilha da análise multicritério oferece para virar índice,
 * já com a amplitude de cada uma.
 *
 * O mínimo e o máximo viajam junto porque o formulário mostra a faixa real da
 * coluna ao lado dos limites que o operador escreve — sem isso ele teria que
 * abrir a planilha para saber se o limite que digitou cai dentro dos dados.
 */
export async function GET(request: Request) {
  const access = await requireCatalogAccess(request);
  if ("response" in access) return access.response;

  try {
    const table = await getAmfeSheetTable();

    return noStoreJson({
      municipalityCount: table.municipalities.length,
      columns: table.criteria.map((criterion) => {
        const values = collectColumnValues(table, criterion.column);

        return {
          ...criterion,
          valueCount: values.length,
          min: values.length > 0 ? Math.min(...values) : null,
          max: values.length > 0 ? Math.max(...values) : null,
        };
      }),
    });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
