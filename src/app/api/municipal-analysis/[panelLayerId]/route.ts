import { NextResponse } from "next/server";
import { getPanelLayerWithMunicipalAnalysis } from "@/repositories/platform/panelLayerRepository";

interface MunicipalAnalysisRouteContext {
  params: Promise<{
    panelLayerId: string;
  }>;
}

export async function GET(_request: Request, context: MunicipalAnalysisRouteContext) {
  const { panelLayerId } = await context.params;
  const layer = await getPanelLayerWithMunicipalAnalysis(
    decodeURIComponent(panelLayerId),
  );

  if (!layer) {
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
      imageData: layer.imageData ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
