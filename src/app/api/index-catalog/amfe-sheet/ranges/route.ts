import {
  catalogErrorResponse,
  noStoreJson,
  readJsonBody,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";
import { getAmfeSheetTable } from "@/repositories/platform/amfeSheetRepository";
import { collectColumnValues } from "@/repositories/platform/amfeSheetTable";
import { suggestColumnClassification } from "@/utils/amfeSheetColumnRanges";

function readString(body: unknown, field: string): string {
  const value =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)[field]
      : undefined;
  return typeof value === "string" ? value.trim() : "";
}

/**
 * As faixas sugeridas para uma coluna, em intervalos iguais.
 *
 * É uma sugestão que o formulário escreve nos campos, e não uma configuração
 * gravada: o que vale na publicação é o que estiver nos limites e nos rótulos
 * quando o operador clicar em validar. Por isso ela é calculada sob demanda e
 * nada aqui toca o rascunho.
 */
export async function POST(request: Request) {
  const access = await requireCatalogAccess(request, { mutation: true });
  if ("response" in access) return access.response;

  try {
    const body = await readJsonBody(request);
    const column = readString(body, "column");
    const classCount = Number(
      (body as Record<string, unknown>)?.classCount ?? NaN,
    );

    const table = await getAmfeSheetTable();
    const criterion = table.criteria.find(
      (candidate) => candidate.column === column,
    );
    if (!criterion) {
      throw new Error(
        `A coluna "${column || "(vazia)"}" não existe na planilha da análise multicritério.`,
      );
    }

    return noStoreJson(
      suggestColumnClassification(
        collectColumnValues(table, column),
        classCount,
        criterion.unit,
      ),
    );
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
