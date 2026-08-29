import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";

vi.mock("server-only", () => ({}));

const eeMocks = vi.hoisted(() => ({
  setDeadline: vi.fn(),
  setAuthToken: vi.fn(),
  setAuthTokenRefresher: vi.fn(),
  initialize: vi.fn(),
}));

vi.mock("@google/earthengine", () => ({
  default: {
    data: {
      setDeadline: eeMocks.setDeadline,
      setAuthToken: eeMocks.setAuthToken,
      setAuthTokenRefresher: eeMocks.setAuthTokenRefresher,
    },
    initialize: eeMocks.initialize,
  },
}));

import {
  clearGeeClientForTests,
  evaluateGeeObject,
  initializeGee,
  withGeeTimeout,
} from "@/infrastructure/earth-engine/client";

/** Objeto do Earth Engine cujo `evaluate` nunca chama de volta. */
class NeverAnsweringGeeObject {
  evaluate = () => {};
}

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const SERVICE_ACCOUNT = JSON.stringify({
  client_email: "gee-reader@example.iam.gserviceaccount.com",
  private_key: privateKey,
  project_id: "example-project",
});

function okTokenResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      access_token: "token",
      token_type: "Bearer",
      expires_in: 3600,
    }),
  } as Response;
}

beforeEach(() => {
  clearGeeClientForTests();
  vi.stubEnv("GEE_OPERATION_TIMEOUT_SECONDS", "0.05");
  vi.stubEnv("GEE_PRIVATE_KEY", SERVICE_ACCOUNT);
  eeMocks.setDeadline.mockReset();
  eeMocks.initialize.mockReset();
  eeMocks.initialize.mockImplementation(
    (_a: unknown, _b: unknown, onSuccess: () => void) => onSuccess(),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  clearGeeClientForTests();
});

describe("teto de relógio das chamadas ao Earth Engine", () => {
  it("desiste de uma operação que não responde, dizendo qual era", async () => {
    await expect(
      withGeeTimeout("getMapId", () => new Promise(() => {})),
    ).rejects.toThrow(/Earth Engine não respondeu em 50 ms: getMapId/u);
  });

  it("devolve o resultado normalmente quando a operação responde a tempo", async () => {
    await expect(
      withGeeTimeout("evaluate", async () => "pronto"),
    ).resolves.toBe("pronto");
  });

  // Sem o teto, um `evaluate` cujo callback nunca chega prende o handler do
  // Node para sempre: o SDK não tem prazo próprio (`deadlineMs_ = 0`).
  it("não deixa um evaluate sem resposta prender o chamador", async () => {
    await expect(
      evaluateGeeObject(new NeverAnsweringGeeObject()),
    ).rejects.toThrow(/não respondeu/u);
  });
});

describe("inicialização do Earth Engine", () => {
  it("configura o prazo de cada tentativa HTTP do SDK", async () => {
    vi.stubEnv("GEE_REQUEST_DEADLINE_SECONDS", "12");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => okTokenResponse()),
    );

    await initializeGee();

    expect(eeMocks.setDeadline).toHaveBeenCalledWith(12_000);
  });

  // Regressão: a promessa de inicialização é memoizada. Sem o teto, um
  // `ee.initialize` que nunca se resolve ficava guardado e toda chamada
  // seguinte esperava para sempre pela mesma promessa, até o restart.
  it("não fica envenenada depois de uma inicialização que travou", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );

    await expect(initializeGee()).rejects.toThrow(/não respondeu/u);

    const workingFetch = vi.fn(async () => okTokenResponse());
    vi.stubGlobal("fetch", workingFetch);

    await expect(initializeGee()).resolves.toBeUndefined();
    expect(workingFetch).toHaveBeenCalled();
  });
});
