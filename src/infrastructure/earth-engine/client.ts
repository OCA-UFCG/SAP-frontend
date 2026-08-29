import "server-only";

import ee from "@google/earthengine";
import { createSign } from "node:crypto";

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GEE_AUTH_SCOPES = [
  "https://www.googleapis.com/auth/earthengine",
  "https://www.googleapis.com/auth/cloud-platform",
];

interface GeeServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id?: string;
}

interface GoogleOAuthToken {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

// Deadline de CADA tentativa HTTP do SDK. Sem isto ele usa `deadlineMs_ = 0`,
// que é "sem prazo": uma conexão pendurada com o Earth Engine nunca retorna e
// fica ocupando para sempre a fila global do processo, que é uma só e atende
// todos os usuários daquela instância.
const DEFAULT_REQUEST_DEADLINE_MS = 30_000;
// Teto de relógio da operação inteira. Existe ALÉM do deadline porque o SDK
// reenfileira sozinho até 10 vezes com backoff de até 120 s: um 429 do Earth
// Engine não vira erro, vira espera, e só com o deadline por tentativa uma
// chamada podia ficar presa por mais de dez minutos antes de desistir.
const DEFAULT_OPERATION_TIMEOUT_MS = 60_000;

function readTimeoutSeconds(variableName: string, fallbackMs: number) {
  const configured = Number(process.env[variableName]);

  if (!Number.isFinite(configured) || configured <= 0) {
    return fallbackMs;
  }

  return Math.floor(configured * 1000);
}

function getOperationTimeoutMs() {
  return readTimeoutSeconds(
    "GEE_OPERATION_TIMEOUT_SECONDS",
    DEFAULT_OPERATION_TIMEOUT_MS,
  );
}

/**
 * Desiste de esperar uma operação do Earth Engine depois do teto configurado.
 *
 * A desistência não cancela a requisição no SDK — ela continua na fila dele.
 * O que muda é que o chamador deixa de ficar preso: a rota responde, o cache
 * serve o valor velho quando existe, e o handler do Node é liberado.
 *
 * @example
 * await withGeeTimeout("getMapId de projects/x/asset", () => getMapId(image));
 */
export function withGeeTimeout<T>(
  operation: string,
  run: () => Promise<T>,
): Promise<T> {
  const timeoutMs = getOperationTimeoutMs();

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Earth Engine não respondeu em ${timeoutMs} ms: ${operation}.`,
        ),
      );
    }, timeoutMs);

    // `unref` evita que o timer sozinho segure o processo vivo; em jsdom o
    // retorno de setTimeout é um número e não tem o método.
    (timer as unknown as { unref?: () => void }).unref?.();

    Promise.resolve()
      .then(run)
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
}

let geeInitialized: Promise<void> | null = null;

function encodeJwtPart(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function parseGeeCredentials(
  rawCredentials: string,
): GeeServiceAccountCredentials {
  const parsed = JSON.parse(
    rawCredentials,
  ) as Partial<GeeServiceAccountCredentials>;

  if (
    typeof parsed.client_email !== "string" ||
    !parsed.client_email.trim() ||
    typeof parsed.private_key !== "string" ||
    !parsed.private_key.includes("BEGIN PRIVATE KEY")
  ) {
    throw new Error(
      "GEE_PRIVATE_KEY must contain valid client_email and private_key fields.",
    );
  }

  return parsed as GeeServiceAccountCredentials;
}

export function resolveGeeProjectId(
  credentials: GeeServiceAccountCredentials,
): string {
  const projectId =
    process.env.GEE_PROJECT_ID?.trim() || credentials.project_id?.trim();

  if (!projectId) {
    throw new Error(
      "GEE_PROJECT_ID must be set or provided as project_id in GEE_PRIVATE_KEY.",
    );
  }

  return projectId;
}

async function fetchGoogleOAuthToken(
  credentials: GeeServiceAccountCredentials,
): Promise<GoogleOAuthToken> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const encodedHeader = encodeJwtPart({ alg: "RS256", typ: "JWT" });
  const encodedPayload = encodeJwtPart({
    iss: credentials.client_email,
    scope: GEE_AUTH_SCOPES.join(" "),
    aud: GOOGLE_OAUTH_TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600,
  });
  const unsignedJwt = `${encodedHeader}.${encodedPayload}`;
  const signature = createSign("RSA-SHA256")
    .update(unsignedJwt)
    .end()
    .sign(credentials.private_key, "base64url");
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json()) as {
    access_token?: unknown;
    error?: unknown;
    error_description?: unknown;
    expires_in?: unknown;
    token_type?: unknown;
  };

  if (!response.ok || typeof body.access_token !== "string") {
    const oauthError =
      typeof body.error === "string" ? body.error : `HTTP ${response.status}`;
    const description =
      typeof body.error_description === "string"
        ? `: ${body.error_description}`
        : "";
    throw new Error(
      `Google OAuth token exchange failed (${oauthError}${description}).`,
    );
  }

  return {
    accessToken: body.access_token,
    expiresIn: typeof body.expires_in === "number" ? body.expires_in : 3600,
    tokenType: typeof body.token_type === "string" ? body.token_type : "Bearer",
  };
}

function configureGeeTokenRefresh(credentials: GeeServiceAccountCredentials) {
  ee.data.setAuthTokenRefresher(
    (
      _authArgs: unknown,
      callback: (result: Record<string, unknown>) => void,
    ) => {
      void fetchGoogleOAuthToken(credentials)
        .then((token) => {
          callback({
            access_token: token.accessToken,
            token_type: token.tokenType,
            expires_in: token.expiresIn,
          });
        })
        .catch((error: unknown) => {
          callback({ error });
        });
    },
  );
}

async function authenticateAndInitialize(): Promise<void> {
  const key = process.env.GEE_PRIVATE_KEY;
  if (!key) {
    throw new Error("GEE_PRIVATE_KEY environment variable not set.");
  }

  const credentials = parseGeeCredentials(key);
  const projectId = resolveGeeProjectId(credentials);
  ee.data.setDeadline(
    readTimeoutSeconds(
      "GEE_REQUEST_DEADLINE_SECONDS",
      DEFAULT_REQUEST_DEADLINE_MS,
    ),
  );
  const token = await fetchGoogleOAuthToken(credentials);

  ee.data.setAuthToken(
    credentials.client_email,
    token.tokenType,
    token.accessToken,
    token.expiresIn,
    GEE_AUTH_SCOPES,
    undefined,
    false,
    true,
  );
  configureGeeTokenRefresh(credentials);

  await new Promise<void>((resolve, reject) => {
    ee.initialize(null, null, resolve, reject, null, projectId);
  });
}

export function initializeGee(): Promise<void> {
  if (geeInitialized) {
    return geeInitialized;
  }

  // O timeout é o que impede a memoização de envenenar o processo: sem ele,
  // um `ee.initialize` que nunca se resolve fica guardado aqui e toda chamada
  // seguinte espera para sempre pela mesma promessa, até o restart.
  geeInitialized = withGeeTimeout(
    "ee.initialize",
    authenticateAndInitialize,
  ).catch((error) => {
    geeInitialized = null;
    throw error;
  });

  return geeInitialized;
}

export function evaluateGeeObject<T>(value: {
  evaluate: (callback: (result: T, error?: unknown) => void) => void;
}): Promise<T> {
  return withGeeTimeout(
    "evaluate",
    () =>
      new Promise<T>((resolve, reject) => {
        value.evaluate((result, error) => {
          if (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
            return;
          }

          resolve(result);
        });
      }),
  );
}

export function clearGeeClientForTests() {
  geeInitialized = null;
}
