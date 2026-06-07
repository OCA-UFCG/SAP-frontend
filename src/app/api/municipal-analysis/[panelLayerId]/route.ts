import { NextResponse } from "next/server";
import {
  getCachedMunicipalAnalysisImageData,
  getMunicipalAnalysisCacheControlHeader,
} from "@/repositories/platform/municipalAnalysisCache";

interface MunicipalAnalysisRouteContext {
  params: Promise<{
    panelLayerId: string;
  }>;
}

export async function GET(
  _request: Request,
  context: MunicipalAnalysisRouteContext,
) {
  const { panelLayerId } = await context.params;
  const url = new URL(_request.url);
  const yearKey = url.searchParams.get("year")?.trim() || undefined;
  const result = await getCachedMunicipalAnalysisImageData(
    decodeURIComponent(panelLayerId),
    yearKey,
  );

  if (!result.found) {
    return NextResponse.json(
      { error: "Panel layer not found." },
      {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return NextResponse.json(
    {
      imageData: result.imageData,
    },
    {
      headers: {
        "Cache-Control": getMunicipalAnalysisCacheControlHeader(),
      },
    },
  );
}
