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

export const denyUnauthenticatedAmfeRequest = async (request: Request) => {
  const authenticatedUserId = await getAuthenticatedUserId(request);

  if (authenticatedUserId) return null;

  return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
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
