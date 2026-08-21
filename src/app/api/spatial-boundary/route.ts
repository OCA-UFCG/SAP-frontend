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

const AREAS_WITH_BOUNDARY = new Set(["biome", "semiarid", "asd"] as const);

function hasBoundaryOverlay(
  selection: SpatialSelection,
): selection is Exclude<
  SpatialSelection,
  { spatialArea: "national" } | { spatialArea: "region" }
> {
  return (AREAS_WITH_BOUNDARY as ReadonlySet<string>).has(
    selection.spatialArea,
  );
}

export async function GET(req: NextRequest) {
  const spatialResult = resolveSpatialSelection(
    req.nextUrl.searchParams.get("spatialArea"),
    req.nextUrl.searchParams.get("spatialValue"),
  );

  if (!spatialResult.ok) {
    return NextResponse.json(
      { error: spatialResult.error },
      { status: 400 },
    );
  }

  const { selection } = spatialResult;

  if (!hasBoundaryOverlay(selection)) {
    return NextResponse.json(
      {
        error:
          "Spatial boundary overlay is only available for biome, semiarid, and asd.",
      },
      { status: 400 },
    );
  }

  try {
    const features =
      selection.spatialArea === "biome"
        ? getAllSpatialBoundaryFeaturesForArea("biome")
        : getSpatialBoundaryFeatures(selection);
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
