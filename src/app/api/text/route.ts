import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/server-session";
import { gerarRelatorioMunicipal } from "@/services/reportTextGenerator";

const MUNICIPALITY_CODE_PATTERN = /^\d{7}$/u;
const PERIOD_PATTERN = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/u;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const unauthorized = await requireAuthenticatedRequest(request);
  if (unauthorized) {
    unauthorized.headers.set("Cache-Control", "no-store");
    return unauthorized;
  }

  const { searchParams } = new URL(request.url);
  const ibgeId = searchParams.get("ibgeId")?.trim();
  const period = searchParams.get("period")?.trim();

  if (!ibgeId || !MUNICIPALITY_CODE_PATTERN.test(ibgeId))
    return error("Invalid or missing ibgeId.", 400);
  if (!period || !PERIOD_PATTERN.test(period))
    return error("Invalid or missing period.", 400);

  try {
    const text = await gerarRelatorioMunicipal(ibgeId, period);
    return new NextResponse(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (cause) {
    console.error("Erro ao gerar relatório em texto:", cause);
    return error("Unable to generate report text.", 502);
  }
}
