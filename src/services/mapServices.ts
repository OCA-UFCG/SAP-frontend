import type { IEEInfo } from "@/utils/interfaces";

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
  panelLayer: IEEInfo,
  signal?: AbortSignal,
): Promise<string | null> {
  const response = await fetch(
    `${API_BASE_URL}/api/ee?name=${encodeURIComponent(id)}&year=${encodeURIComponent(year)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(panelLayer),
      signal,
    },
  );

  const data = await parseEarthEngineResponse(response);

  if (!response.ok) {
    throw new Error(data?.error ?? "Erro ao buscar fontes de mapa.");
  }

  return typeof data?.url === "string" ? data.url : null;
}
