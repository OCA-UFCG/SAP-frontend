import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/server-session";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import { buildDocContent } from "@/services/buildDoc/buildDocContent";
import { buildCachedMunicipalReport } from "@/services/municipalReportCache";
import {
  isReportTerritoryKeyShape,
  resolveReportTerritory,
} from "@/utils/reportTerritory";
import { createServerTiming } from "@/utils/serverTiming";

const PERIOD_PATTERN = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/u;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function getSelectedThemes(layerIds: string[]) {
  return [...new Set(layerIds)];
}

/**
 * O texto de relatório escrito no catálogo, indexado pelo id da camada — a
 * mesma chave que o bloco `[layer: <id>]` do Google Docs usa, para que a
 * montagem do documento não precise saber de onde o texto veio.
 */
async function loadCatalogSectionsByTheme(themes: string[]) {
  const selected = new Set(themes);
  const panelLayers = await getPanelLayers();

  return Object.fromEntries(
    panelLayers
      .filter((layer) => selected.has(layer.id) && layer.reportConfig?.sections.length)
      .map((layer) => [layer.id, layer.reportConfig!.sections]),
  );
}

function getPeriodParts(period: string) {
  const match = PERIOD_PATTERN.exec(period);

  return { year: match?.[1] ?? period, month: match?.[2] ?? "" };
}

export async function GET(request: Request, context: { params: Promise<{ locationKey: string }> }) {
  const timing = createServerTiming();
  const finishAuth = timing.start();
  const unauthorized = await requireAuthenticatedRequest(request);
  finishAuth("auth", "Autenticação");
  if (unauthorized) {
    unauthorized.headers.set("Cache-Control", "no-store");
    unauthorized.headers.set("Server-Timing", timing.header());
    return unauthorized;
  }

  const { locationKey } = await context.params;
  const code = decodeURIComponent(locationKey).trim();
  const searchParams = new URL(request.url).searchParams;
  const period = searchParams.get("period")?.trim();
  const layerIds = (searchParams.get("layers") ?? "")
    .split(",")
    .map((layerId) => layerId.trim())
    .filter(Boolean);

  if (!isReportTerritoryKeyShape(code)) return error("Invalid territory key.", 400);
  const territory = resolveReportTerritory(code);
  if (!territory) return error("Territory not found.", 404);
  if (!period || !PERIOD_PATTERN.test(period)) return error("Invalid or missing period.", 400);
  if (layerIds.length === 0) return error("Missing selected report layers.", 400);

  const themes = getSelectedThemes(layerIds);
  if (themes.length === 0) return error("No Docs template configured for selected layers.", 400);

  const { month, year } = getPeriodParts(period);

  try {
    const report = await buildCachedMunicipalReport(code, period, {
      analysisIds: layerIds,
      onTiming: timing.record,
    });
    const finishDocs = timing.start();
    const content = await buildDocContent({
      themes,
      catalogSectionsByTheme: await loadCatalogSectionsByTheme(themes),
      city: territory.name,
      state: territory.uf ?? "",
      month,
      year,
      ibgeId: code,
      period,
      onTiming: timing.record,
      report,
    });
    finishDocs("build_docs", "Montagem completa dos textos");

    return NextResponse.json({ content }, { headers: {
      "Cache-Control": "no-store",
      "Server-Timing": timing.header(),
    } });
  } catch (cause) {
    console.error("Erro ao montar textos do relatório municipal:", cause);
    return error("Unable to build municipal report docs content.", 502);
  }
}
