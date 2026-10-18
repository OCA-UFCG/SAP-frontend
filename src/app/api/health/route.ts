import { NextResponse } from "next/server";
import { getHealthReport } from "./checks";

/**
 * Diz se o SEDES e cada serviço de que ele depende estão respondendo.
 *
 * Responde 200 com tudo de pé e 503 quando alguma dependência falha, com o
 * nome dela no corpo. É pública e sem login para um monitor externo e o deploy
 * poderem chamá-la.
 */
export async function GET() {
  const report = await getHealthReport();

  return NextResponse.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
