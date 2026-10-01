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

/**
 * Quantas leituras vão ao Earth Engine ao mesmo tempo, somando todos os
 * usuários do processo.
 *
 * O SDK do Earth Engine solta um pedido a cada 350 ms de uma fila única do
 * processo, e o relatório municipal faz algumas dezenas deles: só a espera na
 * fila passava de 10 s. Mandando os pedidos direto à API eles andam juntos, e
 * este teto faz o papel que a fila fazia de não estourar a cota de pedidos
 * simultâneos do projeto.
 */
const GEE_COMPUTE_CONCURRENCY = 20;
/** Prazo de cada tentativa: sem ele uma conexão pendurada ocupa uma vaga do teto para sempre. */
const GEE_COMPUTE_ATTEMPT_TIMEOUT_MS = 30_000;
/** 429 é o Earth Engine pedindo calma; 5xx costuma passar na tentativa seguinte. */
const GEE_COMPUTE_RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const GEE_COMPUTE_MAX_ATTEMPTS = 4;
/** O token é renovado com esta folga, para não expirar no meio de um pedido. */
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 5 * 60_000;

interface GeeClientState {
  initialized: Promise<void> | null;
  credentials: GeeServiceAccountCredentials | null;
  projectId: string | null;
  accessToken: { authorization: string; expiresAt: number } | null;
  accessTokenRefresh: Promise<string> | null;
  activeComputes: number;
  waitingComputes: Array<() => void>;
}

/**
 * O estado do cliente fica no `globalThis`, e não em variáveis do módulo.
 *
 * O Next empacota a subida do servidor (`instrumentation`) separada das rotas,
 * e cada pacote recebia a sua cópia deste módulo. Com o estado no módulo, o
 * Earth Engine inicializado na subida não valia para a rota do relatório, que
 * refazia login e inicialização (~1,4 s) no primeiro pedido depois do deploy, e
 * cada cópia tinha o seu próprio teto de leituras simultâneas.
 * `@google/earthengine` fica fora dos pacotes (`serverExternalPackages`) pelo
 * mesmo motivo: o objeto `ee` inicializado precisa ser o mesmo nos dois lados.
 */
const state = ((
  globalThis as typeof globalThis & { __geeClientState?: GeeClientState }
).__geeClientState ??= {
  initialized: null,
  credentials: null,
  projectId: null,
  accessToken: null,
  accessTokenRefresh: null,
  activeComputes: 0,
  waitingComputes: [],
});

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
  const token = await fetchGoogleOAuthToken(credentials);
  state.credentials = credentials;
  state.projectId = projectId;
  rememberAccessToken(token);

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
  if (state.initialized) {
    return state.initialized;
  }

  state.initialized = authenticateAndInitialize().catch((error) => {
    state.initialized = null;
    throw error;
  });

  return state.initialized;
}

function rememberAccessToken(token: GoogleOAuthToken) {
  state.accessToken = {
    authorization: `${token.tokenType} ${token.accessToken}`,
    expiresAt: Date.now() + token.expiresIn * 1000,
  };
}

async function getAuthorizationHeader(): Promise<string> {
  if (
    state.accessToken &&
    state.accessToken.expiresAt - Date.now() > ACCESS_TOKEN_REFRESH_MARGIN_MS
  ) {
    return state.accessToken.authorization;
  }
  if (!state.credentials) {
    throw new Error("Earth Engine não inicializado: chame initializeGee().");
  }

  state.accessTokenRefresh ??= fetchGoogleOAuthToken(state.credentials)
    .then((token) => {
      rememberAccessToken(token);
      return state.accessToken!.authorization;
    })
    .finally(() => {
      state.accessTokenRefresh = null;
    });

  return state.accessTokenRefresh;
}

async function withComputeSlot<T>(run: () => Promise<T>): Promise<T> {
  if (state.activeComputes >= GEE_COMPUTE_CONCURRENCY) {
    await new Promise<void>((resolve) => state.waitingComputes.push(resolve));
  }
  state.activeComputes += 1;

  try {
    return await run();
  } finally {
    state.activeComputes -= 1;
    state.waitingComputes.shift()?.();
  }
}

function waitBeforeRetry(attempt: number) {
  const delayMs = 500 * 2 ** (attempt - 1) + Math.random() * 250;
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Uma ida à API `value:compute` do Earth Engine, com as novas tentativas que o
 * SDK fazia sozinho: 429, 5xx e falhas de conexão esperam e tentam de novo; o
 * resto vira erro com a mensagem do Earth Engine, a mesma que o `evaluate` do
 * SDK entregava.
 */
async function computeGeeExpression<T>(expression: unknown): Promise<T> {
  if (!state.projectId) {
    throw new Error("Earth Engine não inicializado: chame initializeGee().");
  }
  const url = `https://earthengine.googleapis.com/v1/projects/${state.projectId}/value:compute`;
  const body = JSON.stringify({ expression });

  for (let attempt = 1; ; attempt += 1) {
    const authorization = await getAuthorizationHeader();
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(GEE_COMPUTE_ATTEMPT_TIMEOUT_MS),
      });
    } catch (error) {
      // Conexão recusada, queda de rede ou prazo estourado: a leitura não muda
      // nada no Earth Engine, então repetir é seguro.
      if (attempt >= GEE_COMPUTE_MAX_ATTEMPTS) throw error;
      await waitBeforeRetry(attempt);
      continue;
    }
    const payload = (await response.json().catch(() => ({}))) as {
      result?: T;
      error?: { message?: unknown };
    };

    if (response.ok) return payload.result as T;

    if (
      GEE_COMPUTE_RETRYABLE_STATUS.has(response.status) &&
      attempt < GEE_COMPUTE_MAX_ATTEMPTS
    ) {
      await waitBeforeRetry(attempt);
      continue;
    }

    throw new Error(
      typeof payload.error?.message === "string"
        ? payload.error.message
        : `Earth Engine respondeu HTTP ${response.status}.`,
    );
  }
}

/**
 * O valor de um objeto do Earth Engine, calculado no servidor dele.
 *
 * Faz o mesmo que `value.evaluate()`, mas sem passar pela fila do SDK: o objeto
 * é serializado como o SDK faria e enviado direto à API, dividindo com as
 * outras leituras do processo um teto de pedidos simultâneos.
 */
export async function evaluateGeeObject<T>(value: {
  evaluate: (callback: (result: T, error?: unknown) => void) => void;
}): Promise<T> {
  const expression = ee.Serializer.encodeCloudApi(value);
  return withComputeSlot(() => computeGeeExpression<T>(expression));
}

export function clearGeeClientForTests() {
  state.initialized = null;
  state.credentials = null;
  state.projectId = null;
  state.accessToken = null;
}
