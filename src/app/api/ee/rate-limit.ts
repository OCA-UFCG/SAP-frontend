const EE_RATE_LIMIT_WINDOW_MS = 1000 * 60;
const EE_RATE_LIMIT_MAX_REQUESTS = 30;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const requestsByClient = new Map<string, RateLimitEntry>();

function getClientKey(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headers.get("x-real-ip")?.trim();
  const cfConnectingIp = headers.get("cf-connecting-ip")?.trim();

  return forwardedFor || realIp || cfConnectingIp || "anonymous";
}

export function consumeEeRateLimit(headers: Headers) {
  const now = Date.now();
  const clientKey = getClientKey(headers);
  const currentEntry = requestsByClient.get(clientKey);

  const entry =
    !currentEntry || now >= currentEntry.resetAt
      ? { count: 1, resetAt: now + EE_RATE_LIMIT_WINDOW_MS }
      : { count: currentEntry.count + 1, resetAt: currentEntry.resetAt };

  requestsByClient.set(clientKey, entry);

  return {
    limited: entry.count > EE_RATE_LIMIT_MAX_REQUESTS,
    headers: {
      "X-RateLimit-Limit": String(EE_RATE_LIMIT_MAX_REQUESTS),
      "X-RateLimit-Remaining": String(
        Math.max(0, EE_RATE_LIMIT_MAX_REQUESTS - entry.count),
      ),
      "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
    },
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

export function clearEeRateLimit() {
  requestsByClient.clear();
}

export { EE_RATE_LIMIT_MAX_REQUESTS, EE_RATE_LIMIT_WINDOW_MS };
