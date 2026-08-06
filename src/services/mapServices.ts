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
): Promise<string | null> {
  const params = new URLSearchParams({ name: id, year });
  if (spatialArea) params.set("spatialArea", spatialArea);
  if (spatialValue) params.set("spatialValue", spatialValue);

  const response = await fetch(
    `${API_BASE_URL}/api/ee?${params.toString()}`,
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
