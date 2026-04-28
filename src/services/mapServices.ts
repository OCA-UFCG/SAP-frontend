import type { IImageParam } from "@/utils/interfaces";

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_URL ?? "";

interface EarthEngineUrlResponse {
  error?: string;
  url?: string;
}

export interface EarthEngineTileRequest {
  imageId: string;
  imageParams: IImageParam[];
  minScale?: number;
  maxScale?: number;
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
  request: EarthEngineTileRequest,
  signal?: AbortSignal,
): Promise<string | null> {
  const response = await fetch(
    `${API_BASE_URL}/api/ee?name=${encodeURIComponent(id)}&year=${encodeURIComponent(year)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal,
    },
  );

  const data = await parseEarthEngineResponse(response);

  if (!response.ok) {
    throw new Error(data?.error ?? "Erro ao buscar fontes de mapa.");
  }

  return typeof data?.url === "string" ? data.url : null;
}
