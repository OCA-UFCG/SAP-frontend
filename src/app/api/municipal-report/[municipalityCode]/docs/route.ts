import { NextResponse } from "next/server";
import citiesIndex from "@/data/citiesIndex.json";
import { requireAuthenticatedRequest } from "@/lib/server-session";
import { buildDocContent } from "@/services/buildDoc/buildDocContent";

const MUNICIPALITY_CODE_PATTERN = /^\d{7}$/u;
const PERIOD_PATTERN = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/u;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function getSelectedThemes(layerIds: string[]) {
  return [...new Set(layerIds)];
}

function getPeriodParts(period: string) {
  const match = PERIOD_PATTERN.exec(period);

  return { year: match?.[1] ?? period, month: match?.[2] ?? "" };
}

export async function GET(request: Request, context: { params: Promise<{ municipalityCode: string }> }) {
  const unauthorized = await requireAuthenticatedRequest(request);
  if (unauthorized) {
    unauthorized.headers.set("Cache-Control", "no-store");
    return unauthorized;
  }

  const { municipalityCode } = await context.params;
  const code = decodeURIComponent(municipalityCode).trim();
  const searchParams = new URL(request.url).searchParams;
  const period = searchParams.get("period")?.trim();
  const layerIds = (searchParams.get("layers") ?? "")
    .split(",")
    .map((layerId) => layerId.trim())
    .filter(Boolean);

  if (!MUNICIPALITY_CODE_PATTERN.test(code)) return error("Invalid municipality code.", 400);
  if (!period || !PERIOD_PATTERN.test(period)) return error("Invalid or missing period.", 400);
  if (layerIds.length === 0) return error("Missing selected report layers.", 400);

  const municipality = citiesIndex.find((city) => city.code === code);
  if (!municipality) return error("Municipality not found.", 404);

  const themes = getSelectedThemes(layerIds);
  if (themes.length === 0) return error("No Docs template configured for selected layers.", 400);

  const { month, year } = getPeriodParts(period);

  try {
    const content = await buildDocContent({
      themes,
      city: municipality.name,
      state: municipality.uf.toUpperCase(),
      month,
      year,
      ibgeId: code,
      period,
    });

    return NextResponse.json({ content }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("Erro ao montar textos do relatório municipal:", cause);
    return error("Unable to build municipal report docs content.", 502);
  }
}
