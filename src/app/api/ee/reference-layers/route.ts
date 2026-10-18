import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { consumeEeRateLimit } from "@/app/api/ee/rate-limit";
import { getAuthenticatedUserId } from "@/lib/server-session";
import { ensureEeCacheWarmupStarted } from "@/app/api/ee/services";
import {
  REFERENCE_LAYER_ASSETS,
  resolveReferenceLayerUrls,
} from "@/app/api/ee/referenceLayers";

export async function POST(req: NextRequest) {
  const authenticatedUserId = await getAuthenticatedUserId(req);
  if (!authenticatedUserId) {
    return NextResponse.json(
      { error: "Unauthorized access." },
      { status: 401 },
    );
  }

  ensureEeCacheWarmupStarted();

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

  const layerParam = req.nextUrl.searchParams.get("layer")?.trim() || "";
  const assetId = REFERENCE_LAYER_ASSETS[layerParam];

  if (!assetId) {
    return NextResponse.json(
      {
        error: `Unknown reference layer "${layerParam}". Valid values: ${Object.keys(REFERENCE_LAYER_ASSETS).join(", ")}`,
      },
      { status: 400 },
    );
  }

  try {
    const { url, fillUrl } = await resolveReferenceLayerUrls(layerParam);

    return NextResponse.json({ url, fillUrl }, { status: 200 });
  } catch (error) {
    // O detalhe do erro fica no log do servidor. Para o cliente vai só uma
    // mensagem genérica, para não entregar o funcionamento interno a quem sonda.
    console.error("Falha na rota /api/ee/reference-layers.", error);
    return NextResponse.json(
      { error: "Falha ao carregar as camadas de referência." },
      { status: 500 },
    );
  }
}
