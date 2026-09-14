import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  resolveLayerMapUrl,
  resolveMissedLayerMapUrl,
  type LayerMapUrlUnavailableReason,
} from "@/app/api/ee/layerMapUrl";
import { ensureEeCacheWarmupStarted } from "@/app/api/ee/services";
import { consumeEeRateLimit } from "./rate-limit";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import { getAuthenticatedUserId } from "@/lib/server-session";
import { createServerTiming } from "@/utils/serverTiming";
import { resolveSpatialSelection } from "@/utils/spatialScope";

function describeUnavailable(
  reason: LayerMapUrlUnavailableReason,
  name: string,
  year: string,
) {
  if (reason === "layer_not_found") return `Layer ${name} not found.`;
  if (reason === "municipal_choropleth") {
    return `Layer ${name} is painted as a municipal choropleth and has no Earth Engine tiles.`;
  }
  return `Year ${year} not available for layer ${name}.`;
}

export async function POST(req: NextRequest) {
  const timing = createServerTiming();
  const finishAuth = timing.start();
  const authenticatedUserId = await getAuthenticatedUserId(req);
  finishAuth("auth", "Autenticação");
  if (!authenticatedUserId) {
    return NextResponse.json(
      { error: "Unauthorized access." },
      { status: 401 },
    );
  }

  ensureEeCacheWarmupStarted();

  try {
    const name = req.nextUrl.searchParams.get("name")?.trim() || "";
    const year = req.nextUrl.searchParams.get("year")?.trim() || "";
    const spatialSelectionResult = resolveSpatialSelection(
      req.nextUrl.searchParams.get("spatialArea"),
      req.nextUrl.searchParams.get("spatialValue"),
    );

    if (!name || !year) {
      return NextResponse.json(
        { error: "Missing required query parameters: name and year." },
        { status: 400 },
      );
    }

    if (!spatialSelectionResult.ok) {
      return NextResponse.json(
        { error: spatialSelectionResult.error },
        { status: 400 },
      );
    }

    const finishLayers = timing.start();
    const panelLayers = await getPanelLayers();
    finishLayers("resolve_layer", "Resolução da camada e configuração GEE");

    const finishCache = timing.start();
    const resolution = resolveLayerMapUrl(
      panelLayers,
      name,
      year,
      spatialSelectionResult.selection,
    );
    finishCache(
      "cache_lookup",
      resolution.status === "cached"
        ? "Cache de URL GEE: hit"
        : "Cache de URL GEE: miss",
    );

    if (resolution.status === "unavailable") {
      return NextResponse.json(
        { error: describeUnavailable(resolution.reason, name, year) },
        { status: 404 },
      );
    }

    // Só o miss custa vaga: um hit de cache não gasta cota do Earth Engine, e
    // cobrá-lo era o que fazia o relatório municipal estourar o limite.
    if (resolution.status === "cached") {
      return NextResponse.json(
        { url: resolution.url },
        { status: 200, headers: { "Server-Timing": timing.header() } },
      );
    }

    const rateLimit = consumeEeRateLimit(authenticatedUserId);
    if (rateLimit.limited) {
      return NextResponse.json(
        { error: "Too many Earth Engine requests. Try again later." },
        {
          status: 429,
          headers: {
            ...rateLimit.headers,
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    const finishEarthEngine = timing.start();
    const url = await resolveMissedLayerMapUrl(resolution);
    finishEarthEngine(
      "earth_engine",
      "Geração da URL de tiles no Earth Engine",
    );

    return NextResponse.json(
      { url },
      {
        status: 200,
        headers: { "Server-Timing": timing.header() },
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}
