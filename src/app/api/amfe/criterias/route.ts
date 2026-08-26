import { NextRequest } from "next/server";
import {
  denyUnauthenticatedAmfeRequest,
  proxyToAnalysisBackend,
} from "../backendProxy";

export async function GET(request: NextRequest) {
  const denied = await denyUnauthenticatedAmfeRequest(request);
  if (denied) return denied;

  return proxyToAnalysisBackend("/api/v1/criterias", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
}
