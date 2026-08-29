import { createRateLimiter } from "@/app/api/rateLimit";

const EE_RATE_LIMIT_WINDOW_MS = 1000 * 60;
const EE_RATE_LIMIT_MAX_REQUESTS = 30;

const eeRateLimiter = createRateLimiter({
  windowMs: EE_RATE_LIMIT_WINDOW_MS,
  getMaxRequests: () => EE_RATE_LIMIT_MAX_REQUESTS,
});

export function consumeEeRateLimit(clientKey: string) {
  return eeRateLimiter.consume(clientKey);
}

export function clearEeRateLimit() {
  eeRateLimiter.clear();
}

export { EE_RATE_LIMIT_MAX_REQUESTS, EE_RATE_LIMIT_WINDOW_MS };
