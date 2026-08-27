import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/server-session";

const resolveBackendBaseUrl = () => {
  const apiBaseUrl = process.env.API_BASE_URL?.replace(/\/+$/, "");

  if (!apiBaseUrl) {
    throw new Error(
      "API_BASE_URL is not set; expected the SAP-analise-multicriterial base URL",
    );
  }

  return apiBaseUrl;
};

export type AmfeRequestUser =
  | { userId: string; denied?: undefined }
  | { userId?: undefined; denied: NextResponse };

/**
 * Resolve o dono da requisição AMFE, ou a resposta 401 que a rota deve devolver.
 *
 * Devolve o id em vez de só barrar anônimos porque a guarda de taxa do
 * `/api/amfe/analyze` chaveia por usuário autenticado — nunca por header
 * encaminhável, que o cliente controla.
 *
 * @example
 *   const { userId, denied } = await resolveAmfeRequestUser(request);
 *   if (denied) return denied;
 */
export const resolveAmfeRequestUser = async (
  request: Request,
): Promise<AmfeRequestUser> => {
  const authenticatedUserId = await getAuthenticatedUserId(request);

  if (authenticatedUserId) return { userId: authenticatedUserId };

  return {
    denied: NextResponse.json(
      { error: "Unauthorized access." },
      { status: 401 },
    ),
  };
};

const parseBackendPayload = (rawBody: string): unknown => {
  try {
    return JSON.parse(rawBody);
  } catch {
    return { detail: rawBody };
  }
};

export interface BackendProxyRequest {
  method: "GET" | "POST";
  body?: string;
  headers?: Record<string, string>;
}

export const proxyToAnalysisBackend = async (
  path: string,
  { method, body, headers = {} }: BackendProxyRequest,
): Promise<Response> => {
  try {
    const backendResponse = await fetch(`${resolveBackendBaseUrl()}${path}`, {
      method,
      headers,
      body,
    });

    const rawBody = await backendResponse.text();
    const payload = parseBackendPayload(rawBody);

    return NextResponse.json(payload, { status: backendResponse.status });
  } catch (error) {
    console.error(`AMFE proxy error on ${path}`, error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : `Failed to reach the analysis backend at ${path}`,
      },
      { status: 500 },
    );
  }
};
