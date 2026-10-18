import { createRateLimiter } from "@/utils/rateLimitStore";

const LOGS_RATE_LIMIT_WINDOW_MS = 1000 * 60;
const LOGS_RATE_LIMIT_MAX_AUTHENTICATED_EVENTS = 120;
const LOGS_RATE_LIMIT_MAX_ANONYMOUS_EVENTS = 60;

const logsRateLimiter = createRateLimiter({
  windowMs: LOGS_RATE_LIMIT_WINDOW_MS,
});

export function consumeLogsRateLimit(
  clientKey: string,
  eventUnits: number,
  maxEvents: number,
) {
  return logsRateLimiter.consume(clientKey, maxEvents, eventUnits);
}

export function clearLogsRateLimit() {
  logsRateLimiter.clear();
}

export {
  LOGS_RATE_LIMIT_MAX_ANONYMOUS_EVENTS,
  LOGS_RATE_LIMIT_MAX_AUTHENTICATED_EVENTS,
  LOGS_RATE_LIMIT_WINDOW_MS,
};
