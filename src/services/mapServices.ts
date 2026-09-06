import type {
  EeMapUrlEntry,
  EeMapUrlRequestItem,
  EeMapUrlsResponse,
} from "@/contracts/eeMapUrls";
import type { SpatialArea } from "@/utils/spatialScope";

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_URL ?? "";

interface EarthEngineUrlResponse {
  error?: string;
  url?: string;
}

async function parseEarthEngineResponse(
  response: Response,
): Promise<EarthEngineUrlResponse | null> {
  try {
    return (await response.json()) as EarthEngineUrlResponse;
  } catch {
    return null;
  }
}

export async function fetchMapURL(
  id: string,
  year: string,
  signal?: AbortSignal,
  spatialArea?: SpatialArea,
  spatialValue?: string,
  apiPath = "/api/ee",
): Promise<string | null> {
  const params = new URLSearchParams({ name: id, year });
  if (spatialArea) params.set("spatialArea", spatialArea);
  if (spatialValue) params.set("spatialValue", spatialValue);

  const response = await fetch(
    `${API_BASE_URL}${apiPath}?${params.toString()}`,
    {
      method: "POST",
      signal,
      credentials: "include",
    },
  );

  const data = await parseEarthEngineResponse(response);

  if (!response.ok) {
    throw new Error(data?.error ?? "Erro ao buscar fontes de mapa.");
  }

  return typeof data?.url === "string" ? data.url : null;
}

/**
 * Resolve num único pedido as URLs de tiles de várias camadas + períodos.
 *
 * O relatório municipal usa isso em vez de uma requisição por mapa: com 20
 * camadas, as últimas voltavam 429 do limitador do `/api/ee` e o item saía sem
 * imagem.
 *
 * @example
 * const maps = await fetchReportMapURLs([{ name: "anaseca", year: "2024-12" }]);
 */
export async function fetchReportMapURLs(
  items: readonly EeMapUrlRequestItem[],
  signal?: AbortSignal,
): Promise<EeMapUrlEntry[]> {
  const response = await fetch(`${API_BASE_URL}/api/ee/map-urls`, {
    method: "POST",
    signal,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ maps: items }),
  });

  const data = (await parseEarthEngineResponse(response)) as
    (EarthEngineUrlResponse & Partial<EeMapUrlsResponse>) | null;

  if (!response.ok) {
    throw new Error(data?.error ?? "Erro ao buscar fontes de mapa.");
  }

  return Array.isArray(data?.maps) ? data.maps : [];
}
