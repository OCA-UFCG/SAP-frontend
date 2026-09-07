import { createRateLimitStore } from "@/utils/rateLimitStore";

const LOGS_RATE_LIMIT_WINDOW_MS = 1000 * 60;
const LOGS_RATE_LIMIT_MAX_AUTHENTICATED_EVENTS = 120;
const LOGS_RATE_LIMIT_MAX_ANONYMOUS_EVENTS = 60;

const requestsByClient = createRateLimitStore();

export function consumeLogsRateLimit(
  clientKey: string,
  eventUnits: number,
  maxEvents: number,
) {
  const now = Date.now();
  const currentEntry = requestsByClient.get(clientKey, now);

  const entry = !currentEntry
    ? { count: eventUnits, resetAt: now + LOGS_RATE_LIMIT_WINDOW_MS }
    : {
        count: currentEntry.count + eventUnits,
        resetAt: currentEntry.resetAt,
      };

  requestsByClient.set(clientKey, entry, now);

  return {
    limited: entry.count > maxEvents,
    headers: {
      "X-RateLimit-Limit": String(maxEvents),
      "X-RateLimit-Remaining": String(Math.max(0, maxEvents - entry.count)),
      "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
    },
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

export function clearLogsRateLimit() {
  requestsByClient.clear();
}

export {
  LOGS_RATE_LIMIT_MAX_ANONYMOUS_EVENTS,
  LOGS_RATE_LIMIT_MAX_AUTHENTICATED_EVENTS,
  LOGS_RATE_LIMIT_WINDOW_MS,
};
