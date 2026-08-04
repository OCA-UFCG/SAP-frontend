import { NextResponse } from "next/server";
import {
  hasTrustedMutationOrigin,
  resolveCatalogRequestAccess,
} from "@/lib/catalog-access";
import { getCatalogValidationFromError } from "@/services/indexCatalog/indexCatalogService";

export async function requireCatalogAccess(
  request: Request,
  options: { mutation?: boolean } = {},
) {
  const access = await resolveCatalogRequestAccess(request);

  if (!access.allowed) {
    return {
      response: NextResponse.json(
        {
          error:
            access.status === 401
              ? "Sessão não autenticada."
              : "Usuário sem acesso ao catálogo.",
        },
        {
          status: access.status,
          headers: { "Cache-Control": "no-store" },
        },
      ),
    } as const;
  }

  if (options.mutation && !hasTrustedMutationOrigin(request)) {
    return {
      response: NextResponse.json(
        { error: "Origem da requisição não autorizada." },
        {
          status: 403,
          headers: { "Cache-Control": "no-store" },
        },
      ),
    } as const;
  }

  return { user: access.user } as const;
}

export async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new Error("O corpo da requisição deve ser JSON válido.");
  }
}

export function catalogErrorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Falha inesperada no catálogo.";
  const validation = getCatalogValidationFromError(error);
  const isInputError =
    /obrigat|inválid|inval|informe|selecione|máximo|publicados|legados|rascunho|prévia|confirme|confirmação|ação/iu.test(
      message,
    );

  console.error("Erro no catálogo de índices:", error);

  return NextResponse.json(
    {
      error: message,
      ...(validation ? { validation } : {}),
    },
    {
      status: validation ? 422 : isInputError ? 400 : 502,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export function noStoreJson(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
