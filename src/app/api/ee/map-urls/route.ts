import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  resolveLayerMapUrl,
  resolveMissedLayerMapUrl,
  type LayerMapUrlResolution,
} from "@/app/api/ee/layerMapUrl";
import { ensureEeCacheWarmupStarted } from "@/app/api/ee/services";
import { consumeEeRateLimit } from "../rate-limit";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import { getAuthenticatedUserId } from "@/lib/server-session";
import { createServerTiming } from "@/utils/serverTiming";
import { DEFAULT_SPATIAL_SELECTION } from "@/utils/spatialScope";
import {
  EE_MAP_URLS_DEADLINE_MS,
  parseEeMapUrlRequest,
  type EeMapUrlEntry,
  type EeMapUrlRequestItem,
} from "@/contracts/eeMapUrls";

/**
 * Resolve de uma vez as URLs de tiles de várias camadas + períodos.
 *
 * Existe para o relatório municipal, que precisa de uma URL por camada e pedia
 * cada uma numa requisição própria: 20 camadas viravam 20 idas ao servidor
 * contra um limite de 30 por minuto, e as últimas voltavam 429 — o item saía
 * sem imagem do mapa.
 *
 * O recorte espacial é sempre o nacional porque é o que o relatório usa; quem
 * precisa de outro continua pedindo por `/api/ee`.
 *
 * A requisição não passa de `EE_MAP_URLS_DEADLINE_MS`: o que o Earth Engine não
 * entregar a tempo volta como `pending`, com a chamada seguindo em voo.
 */
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

  const parsed = parseEeMapUrlRequest(await readJsonBody(req));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const finishLayers = timing.start();
    const panelLayers = await getPanelLayers();
    finishLayers("resolve_layer", "Resolução das camadas e configuração GEE");

    const resolutions = parsed.items.map((item) => ({
      item,
      resolution: resolveLayerMapUrl(
        panelLayers,
        item.name,
        item.year,
        DEFAULT_SPATIAL_SELECTION,
      ),
    }));

    const misses = resolutions.filter(
      ({ resolution }) => resolution.status === "miss",
    );
    const rateLimit = consumeEeRateLimit(authenticatedUserId, misses.length);
    const allowedMisses = new Set(
      misses.slice(0, rateLimit.granted).map(({ item }) => item),
    );

    const finishEarthEngine = timing.start();
    const deadline = waitForDeadline();
    const maps = await Promise.all(
      resolutions.map(({ item, resolution }) =>
        Promise.race([
          buildEntry(item, resolution, allowedMisses.has(item)),
          deadline.then(() => pendingEntry(item)),
        ]),
      ),
    );
    finishEarthEngine(
      "earth_engine",
      `Geração de ${rateLimit.granted} URL(s) de tiles no Earth Engine`,
    );

    return NextResponse.json(
      { maps },
      {
        status: 200,
        headers: { ...rateLimit.headers, "Server-Timing": timing.header() },
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}

async function readJsonBody(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function waitForDeadline() {
  return new Promise<void>((resolve) =>
    setTimeout(resolve, EE_MAP_URLS_DEADLINE_MS).unref?.(),
  );
}

/**
 * Só quem estava esperando o Earth Engine chega aqui: cache, camada inexistente
 * e limite estourado respondem na hora e ganham a corrida contra o prazo.
 */
function pendingEntry(item: EeMapUrlRequestItem): EeMapUrlEntry {
  return { name: item.name, year: item.year, status: "pending" };
}

/**
 * Uma camada nunca derruba o lote: quem falha volta com `status` e o relatório
 * mostra "imagem indisponível" naquele item em vez de um quadro vazio.
 *
 * `isAllowed` só decide o destino de um miss. Uma chamada já em voo entra na
 * promessa existente sem gerar ida nova ao Earth Engine, então ela nunca é
 * recusada por limite — é exatamente o caso de quem volta a perguntar pelas
 * camadas que ficaram `pending`.
 */
async function buildEntry(
  item: EeMapUrlRequestItem,
  resolution: LayerMapUrlResolution,
  isAllowed: boolean,
): Promise<EeMapUrlEntry> {
  const identity = { name: item.name, year: item.year };

  if (resolution.status === "unavailable") {
    return { ...identity, status: resolution.reason };
  }

  if (resolution.status === "cached") {
    return { ...identity, url: resolution.url };
  }

  if (resolution.status === "miss" && !isAllowed) {
    return { ...identity, status: "rate_limited" };
  }

  try {
    return { ...identity, url: await resolveMissedLayerMapUrl(resolution) };
  } catch (error) {
    console.error(
      `[ee/map-urls] falha ao gerar a URL de tiles: ${item.name} (${item.year})`,
      error,
    );
    return { ...identity, status: "error" };
  }
}
