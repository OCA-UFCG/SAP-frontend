import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { FeatureCollection, Geometry } from "geojson";
import {
  getAllSpatialBoundaryFeaturesForArea,
  getSpatialBoundaryFeatures,
} from "@/app/api/ee/spatialBoundaries";
import {
  resolveSpatialSelection,
  type SpatialSelection,
} from "@/utils/spatialScope";

const AREAS_WITH_BOUNDARY = ["biome", "semiarid", "asd"] as const;
type BoundaryOverlayArea = (typeof AREAS_WITH_BOUNDARY)[number];
type BoundarySelection = Exclude<
  SpatialSelection,
  { spatialArea: "national" } | { spatialArea: "region" }
>;

/**
 * `scope=area` devolve todas as features da área, e não só a seleção: em modo
 * bioma o mapa precisa dos vizinhos desenhados para o hover e o clique poderem
 * trocar de bioma. Como a resposta não depende do `spatialValue`, a URL também
 * não pede um — assim o navegador guarda uma cópia só da coleção, em vez de uma
 * por bioma, e a resposta antiga (uma feature) não se mistura com a nova.
 */
const WHOLE_AREA_SCOPE = "area";

type BoundaryRequest =
  | { ok: true; kind: "whole-area"; area: BoundaryOverlayArea }
  | { ok: true; kind: "selection"; selection: BoundarySelection }
  | { ok: false; error: string };

const isBoundaryOverlayArea = (
  value: string | null,
): value is BoundaryOverlayArea =>
  (AREAS_WITH_BOUNDARY as readonly string[]).includes(value ?? "");

function resolveWholeAreaRequest(spatialArea: string | null): BoundaryRequest {
  if (!isBoundaryOverlayArea(spatialArea)) {
    return {
      ok: false,
      error: `Invalid spatialArea ${spatialArea} for scope=${WHOLE_AREA_SCOPE}; expected one of ${AREAS_WITH_BOUNDARY.join(", ")}.`,
    };
  }
  return { ok: true, kind: "whole-area", area: spatialArea };
}

function resolveSelectionRequest(params: URLSearchParams): BoundaryRequest {
  const spatialResult = resolveSpatialSelection(
    params.get("spatialArea"),
    params.get("spatialValue"),
  );

  if (!spatialResult.ok) {
    return { ok: false, error: spatialResult.error };
  }

  if (!isBoundaryOverlayArea(spatialResult.selection.spatialArea)) {
    return {
      ok: false,
      error:
        "Spatial boundary overlay is only available for biome, semiarid, and asd.",
    };
  }

  return {
    ok: true,
    kind: "selection",
    selection: spatialResult.selection as BoundarySelection,
  };
}

function resolveBoundaryRequest(params: URLSearchParams): BoundaryRequest {
  if (params.get("scope") === WHOLE_AREA_SCOPE) {
    return resolveWholeAreaRequest(params.get("spatialArea"));
  }
  return resolveSelectionRequest(params);
}

export async function GET(req: NextRequest) {
  const request = resolveBoundaryRequest(req.nextUrl.searchParams);

  if (!request.ok) {
    return NextResponse.json({ error: request.error }, { status: 400 });
  }

  try {
    const features =
      request.kind === "whole-area"
        ? getAllSpatialBoundaryFeaturesForArea(request.area)
        : getSpatialBoundaryFeatures(request.selection);
    const featureCollection: FeatureCollection<Geometry, { name: string }> = {
      type: "FeatureCollection",
      features: [...features],
    };

    return NextResponse.json(featureCollection, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}
