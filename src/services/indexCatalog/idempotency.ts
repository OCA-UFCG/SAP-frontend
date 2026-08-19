import "server-only";

const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

interface IdempotencyEntry<T> {
  expiresAt: number;
  promise: Promise<T>;
}

const operations = new Map<string, IdempotencyEntry<unknown>>();

export function getIdempotencyKey(request: Request) {
  const value = request.headers.get("idempotency-key")?.trim();

  if (!value || value.length < 8 || value.length > 200) {
    throw new Error(
      "Envie um Idempotency-Key entre 8 e 200 caracteres para esta ação.",
    );
  }

  return value;
}

export function runCatalogIdempotently<T>(
  scope: string,
  key: string,
  operation: () => Promise<T>,
) {
  const now = Date.now();

  for (const [storedKey, entry] of operations) {
    if (entry.expiresAt <= now) {
      operations.delete(storedKey);
    }
  }

  const operationKey = `${scope}:${key}`;
  const current = operations.get(operationKey) as
    IdempotencyEntry<T> | undefined;

  if (current) {
    return current.promise;
  }

  const promise = operation().catch((error) => {
    operations.delete(operationKey);
    throw error;
  });
  operations.set(operationKey, {
    expiresAt: now + IDEMPOTENCY_TTL_MS,
    promise,
  });

  return promise;
}
