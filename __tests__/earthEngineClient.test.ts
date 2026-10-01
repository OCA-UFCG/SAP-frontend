import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@google/earthengine", () => ({
  default: {
    data: { setAuthToken: vi.fn(), setAuthTokenRefresher: vi.fn() },
    initialize: (_baseUrl: unknown, _tileUrl: unknown, onSuccess: () => void) =>
      onSuccess(),
    Serializer: {
      encodeCloudApi: (value: { id: string }) => ({ serialized: value.id }),
    },
  },
}));

import {
  clearGeeClientForTests,
  evaluateGeeObject,
  initializeGee,
  parseGeeCredentials,
  resolveGeeProjectId,
} from "@/infrastructure/earth-engine/client";

const originalProjectId = process.env.GEE_PROJECT_ID;

afterEach(() => {
  if (originalProjectId === undefined) {
    delete process.env.GEE_PROJECT_ID;
  } else {
    process.env.GEE_PROJECT_ID = originalProjectId;
  }
});

describe("Earth Engine client configuration", () => {
  it("accepts the service-account JSON stored in GEE_PRIVATE_KEY", () => {
    const credentials = parseGeeCredentials(
      JSON.stringify({
        client_email: "gee-reader@example.iam.gserviceaccount.com",
        private_key:
          "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
        project_id: "service-account-project",
      }),
    );

    expect(credentials.client_email).toBe(
      "gee-reader@example.iam.gserviceaccount.com",
    );
    expect(resolveGeeProjectId(credentials)).toBe("service-account-project");
  });

  it("uses GEE_PROJECT_ID as the explicit consumer-project override", () => {
    process.env.GEE_PROJECT_ID = "runtime-project";

    expect(
      resolveGeeProjectId({
        client_email: "gee-reader@example.iam.gserviceaccount.com",
        private_key:
          "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
        project_id: "service-account-project",
      }),
    ).toBe("runtime-project");
  });

  it("rejects incomplete credentials before making a network request", () => {
    expect(() =>
      parseGeeCredentials(
        JSON.stringify({ client_email: "gee-reader@example.com" }),
      ),
    ).toThrow(/client_email and private_key/u);
  });
});

const COMPUTE_URL =
  "https://earthengine.googleapis.com/v1/projects/test-project/value:compute";

function geeObject(id: string) {
  return { id, evaluate: vi.fn() };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("evaluateGeeObject", () => {
  const originalPrivateKey = process.env.GEE_PRIVATE_KEY;
  let computeResponses: Array<() => Promise<Response>>;
  let computeCalls: Array<{ body: unknown; authorization: string | null }>;

  beforeEach(async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
    process.env.GEE_PRIVATE_KEY = JSON.stringify({
      client_email: "gee-reader@example.iam.gserviceaccount.com",
      private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
      project_id: "test-project",
    });
    delete process.env.GEE_PROJECT_ID;
    computeResponses = [];
    computeCalls = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.startsWith("https://oauth2.googleapis.com/")) {
          return jsonResponse({
            access_token: "token-1",
            token_type: "Bearer",
            expires_in: 3600,
          });
        }
        expect(url).toBe(COMPUTE_URL);
        computeCalls.push({
          body: JSON.parse(String(init.body)),
          authorization: new Headers(init.headers).get("Authorization"),
        });
        const next = computeResponses.shift();
        return next ? next() : jsonResponse({ result: "ok" });
      }),
    );

    clearGeeClientForTests();
    await initializeGee();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearGeeClientForTests();
    if (originalPrivateKey === undefined) delete process.env.GEE_PRIVATE_KEY;
    else process.env.GEE_PRIVATE_KEY = originalPrivateKey;
  });

  it("envia o objeto serializado direto à API, sem a fila do SDK", async () => {
    const value = geeObject("colunas");
    computeResponses.push(async () => jsonResponse({ result: ["ano"] }));

    await expect(evaluateGeeObject(value)).resolves.toEqual(["ano"]);

    expect(value.evaluate).not.toHaveBeenCalled();
    expect(computeCalls).toEqual([
      {
        body: { expression: { serialized: "colunas" } },
        authorization: "Bearer token-1",
      },
    ]);
  });

  // Regressão: a subida do servidor e a rota recebem cópias separadas deste
  // módulo. Com o estado no módulo, a rota refazia login e inicialização no
  // primeiro relatório depois do deploy.
  it("usa a inicialização feita por outra cópia do módulo, como a da subida", async () => {
    vi.resetModules();
    const routeCopy = await import("@/infrastructure/earth-engine/client");
    const oauthCallsBefore = vi
      .mocked(fetch)
      .mock.calls.filter(([url]) => String(url).includes("oauth2")).length;

    await routeCopy.initializeGee();
    await expect(
      routeCopy.evaluateGeeObject(geeObject("colunas")),
    ).resolves.toBe("ok");

    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(([url]) => String(url).includes("oauth2")),
    ).toHaveLength(oauthCallsBefore);
  });

  it("tenta de novo quando o Earth Engine pede calma com um 429", async () => {
    computeResponses.push(
      async () =>
        jsonResponse({ error: { message: "Too many requests" } }, 429),
      async () => jsonResponse({ result: 42 }),
    );

    await expect(evaluateGeeObject(geeObject("linhas"))).resolves.toBe(42);
    expect(computeCalls).toHaveLength(2);
  });

  it("entrega a mensagem de erro do Earth Engine, como o evaluate do SDK", async () => {
    computeResponses.push(async () =>
      jsonResponse(
        { error: { message: "Collection asset 'x' not found." } },
        400,
      ),
    );

    await expect(evaluateGeeObject(geeObject("linhas"))).rejects.toThrow(
      "Collection asset 'x' not found.",
    );
    expect(computeCalls).toHaveLength(1);
  });

  it("não passa de 20 leituras simultâneas no processo", async () => {
    let active = 0;
    let peak = 0;
    const releases: Array<() => void> = [];
    for (let index = 0; index < 25; index += 1) {
      computeResponses.push(() => {
        active += 1;
        peak = Math.max(peak, active);
        return new Promise<Response>((resolve) => {
          releases.push(() => {
            active -= 1;
            resolve(jsonResponse({ result: index }));
          });
        });
      });
    }

    const reads = Array.from({ length: 25 }, (_, index) =>
      evaluateGeeObject(geeObject(`leitura-${index}`)),
    );
    await vi.waitFor(() => expect(releases).toHaveLength(20));
    while (releases.length > 0) {
      releases.shift()!();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await Promise.all(reads);

    expect(peak).toBe(20);
    expect(computeCalls).toHaveLength(25);
  });
});
