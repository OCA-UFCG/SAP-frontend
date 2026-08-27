import { NextRequest, NextResponse } from "next/server";
import {
  proxyToAnalysisBackend,
  resolveAmfeRequestUser,
} from "../backendProxy";
import { consumeAmfeAnalyzeRateLimit } from "../rate-limit";

export async function POST(request: NextRequest) {
  const { userId, denied } = await resolveAmfeRequestUser(request);
  if (denied) return denied;

  const rateLimit = consumeAmfeAnalyzeRateLimit(userId);
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Too many analysis requests. Try again later." },
      {
        status: 429,
        headers: {
          ...rateLimit.headers,
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  const body = await request.text();

  return proxyToAnalysisBackend("/api/v1/analyze", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
  });
}
