import { NextResponse } from "next/server";
import { requireCatalogAccess } from "@/app/api/index-catalog/http";
import { countPendingAccessRequests } from "@/lib/access-requests";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Quantos pedidos de acesso estão esperando decisão.
 *
 * Alimenta o número no item "Aprovações" da trilha. Fica numa rota à parte, e
 * não na carga da plataforma, para a conta no Firestore nunca atrasar a
 * abertura do mapa. Só os operadores veem, com a mesma proteção da tela de
 * aprovação.
 */
export async function GET(request: Request) {
  const access = await requireCatalogAccess(request);

  if ("response" in access) {
    return access.response;
  }

  try {
    const count = await countPendingAccessRequests();
    return NextResponse.json({ count }, { headers: NO_STORE });
  } catch (error) {
    console.error("Falha ao contar os pedidos de acesso pendentes.", error);
    return NextResponse.json(
      { error: "Não foi possível contar os pedidos." },
      { status: 500, headers: NO_STORE },
    );
  }
}
