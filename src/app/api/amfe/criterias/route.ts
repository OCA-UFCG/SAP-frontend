import { NextRequest } from "next/server";
import {
  proxyToAnalysisBackend,
  resolveAmfeRequestUser,
} from "../backendProxy";

export async function GET(request: NextRequest) {
  const { denied } = await resolveAmfeRequestUser(request);
  if (denied) return denied;

  return proxyToAnalysisBackend("/api/v1/criterias", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
}
