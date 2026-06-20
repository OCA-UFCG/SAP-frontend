const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_URL ?? "";

interface EarthEngineUrlResponse {
  diagnostics?: Record<string, unknown>;
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
): Promise<string | null> {
  const response = await fetch(
    `${API_BASE_URL}/api/ee?name=${encodeURIComponent(id)}&year=${encodeURIComponent(year)}`,
    {
      method: "POST",
      signal,
      credentials: "include",
    },
  );

  const data = await parseEarthEngineResponse(response);

  if (!response.ok) {
    const message = data?.error ?? "Erro ao buscar fontes de mapa.";
    const requestId =
      response.headers?.get?.("X-EE-Request-ID") ??
      (typeof data?.diagnostics?.requestId === "string"
        ? data.diagnostics.requestId
        : null);

    console.error("[GEE] Tile URL request failed", {
      message,
      status: response.status,
      statusText: response.statusText,
      requestId,
      layer: id,
      year,
      diagnostics: data?.diagnostics ?? null,
    });

    const error = new Error(message) as Error & {
      diagnostics?: Record<string, unknown>;
      requestId?: string | null;
    };
    error.name = "EarthEngineRequestError";
    error.diagnostics = data?.diagnostics;
    error.requestId = requestId;
    throw error;
  }

  return typeof data?.url === "string" ? data.url : null;
}
