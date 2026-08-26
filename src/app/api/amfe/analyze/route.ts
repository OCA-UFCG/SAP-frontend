import { NextRequest } from "next/server";
import {
  denyUnauthenticatedAmfeRequest,
  proxyToAnalysisBackend,
} from "../backendProxy";

export async function POST(request: NextRequest) {
  const denied = await denyUnauthenticatedAmfeRequest(request);
  if (denied) return denied;

  const body = await request.text();

  return proxyToAnalysisBackend("/api/v1/analyze", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
  });
}
