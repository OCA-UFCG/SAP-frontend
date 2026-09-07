import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/app/api/ee/services", () => ({
  ensureEeCacheWarmupStarted: vi.fn(),
  getEarthEngineUrl: vi.fn(),
}));

vi.mock("@/lib/server-session", () => ({
  getAuthenticatedUserId: vi.fn().mockResolvedValue("user-123"),
}));

vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayers: vi.fn(),
}));

import { POST } from "@/app/api/ee/map-urls/route";
import { clearEarthEngineCacheForLayer } from "@/app/api/ee/cache";
import {
  clearEeRateLimit,
  consumeEeRateLimit,
  EE_RATE_LIMIT_MAX_REQUESTS,
} from "@/app/api/ee/rate-limit";
import { EE_MAP_URLS_DEADLINE_MS } from "@/contracts/eeMapUrls";
import { getEarthEngineUrl } from "@/app/api/ee/services";
import { getAuthenticatedUserId } from "@/lib/server-session";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import type { EeMapUrlEntry } from "@/contracts/eeMapUrls";

const mockedGetEarthEngineUrl = vi.mocked(getEarthEngineUrl);
const mockedGetPanelLayers = vi.mocked(getPanelLayers);
const mockedGetAuthenticatedUserId = vi.mocked(getAuthenticatedUserId);

const YEARS = ["2024-12", "2023-12", "2022-12"] as const;

function createReportLayer(id: string) {
  return {
    sys: { id },
    name: id,
    id,
    description: "",
    panelPosition: 1,
    imageData: Object.fromEntries(
      YEARS.map((year, index) => [
        year,
        {
          default: index === 0,
          imageId: `projects/example/${id}-${year}`,
          imageParams: [{ color: "#111111", label: "classe" }],
        },
      ]),
    ),
    minScale: 0,
    maxScale: 1,
  };
}

function createMapUrlsRequest(maps: unknown) {
  return {
    headers: new Headers({ Cookie: "session=mock-session-cookie" }),
    json: vi.fn().mockResolvedValue({ maps }),
  } as unknown as NextRequest;
}

async function readMaps(response: Response) {
  const body = (await response.json()) as { maps?: EeMapUrlEntry[] };
  return body.maps ?? [];
}

// Limpa também as promessas em voo: um teste que deixa uma ida ao Earth Engine
// pendurada faria o próximo entrar nela em vez de chamar de novo.
function clearLayerCache(id: string) {
  clearEarthEngineCacheForLayer(id);
}

describe("POST /api/ee/map-urls", () => {
  beforeEach(() => {
    mockedGetEarthEngineUrl.mockReset();
    mockedGetEarthEngineUrl.mockImplementation(
      async (imageId: string) => `https://tiles.example/${imageId}`,
    );
    mockedGetPanelLayers.mockResolvedValue([
      createReportLayer("anaseca"),
      createReportLayer("deg"),
    ] as never);
    mockedGetAuthenticatedUserId.mockReset();
    mockedGetAuthenticatedUserId.mockResolvedValue("user-123");
    clearEeRateLimit();
    clearLayerCache("anaseca");
    clearLayerCache("deg");
  });

  afterEach(() => {
    clearEeRateLimit();
    clearLayerCache("anaseca");
    clearLayerCache("deg");
  });

  it("returns 401 before touching Contentful when the session is invalid", async () => {
    mockedGetAuthenticatedUserId.mockResolvedValueOnce(null);

    const res = await POST(
      createMapUrlsRequest([{ name: "anaseca", year: "2024-12" }]),
    );

    expect(res.status).toBe(401);
    expect(mockedGetPanelLayers).not.toHaveBeenCalled();
  });

  it("resolves every requested layer in a single request", async () => {
    const res = await POST(
      createMapUrlsRequest([
        { name: "anaseca", year: "2024-12" },
        { name: "deg", year: "2023-12" },
      ]),
    );

    expect(res.status).toBe(200);
    expect(await readMaps(res)).toEqual([
      {
        name: "anaseca",
        year: "2024-12",
        url: "https://tiles.example/projects/example/anaseca-2024-12",
      },
      {
        name: "deg",
        year: "2023-12",
        url: "https://tiles.example/projects/example/deg-2023-12",
      },
    ]);
  });

  // Regressão: o período do relatório vem dos dados da análise e pode não
  // existir no `imageData` da camada. Isso derrubava só aquele item, sem dizer
  // por quê.
  it("marks a period the layer has no image for without failing the batch", async () => {
    const res = await POST(
      createMapUrlsRequest([
        { name: "anaseca", year: "2024-12" },
        { name: "prev_anomalia_precipitacao", year: "2026-05" },
        { name: "deg", year: "2026-05" },
      ]),
    );

    expect(await readMaps(res)).toEqual([
      { name: "anaseca", year: "2024-12", url: expect.any(String) },
      {
        name: "prev_anomalia_precipitacao",
        year: "2026-05",
        status: "layer_not_found",
      },
      { name: "deg", year: "2026-05", status: "year_not_found" },
    ]);
  });

  it("keeps resolving the other layers when one Earth Engine call fails", async () => {
    mockedGetEarthEngineUrl.mockImplementationOnce(async () => {
      throw new Error("Asset not readable by the service account");
    });

    const res = await POST(
      createMapUrlsRequest([
        { name: "anaseca", year: "2024-12" },
        { name: "deg", year: "2024-12" },
      ]),
    );
    const maps = await readMaps(res);

    expect(maps[0]).toEqual({
      name: "anaseca",
      year: "2024-12",
      status: "error",
    });
    expect(maps[1].url).toBeTruthy();
  });

  // O relatório inteiro custa uma vaga por ida ao Earth Engine, não uma por
  // camada pedida: repetir a mesma camada não pode consumir o limite duas vezes.
  it("spends one rate limit slot per Earth Engine call", async () => {
    await POST(
      createMapUrlsRequest([
        { name: "anaseca", year: "2024-12" },
        { name: "anaseca", year: "2024-12" },
        { name: "deg", year: "2024-12" },
      ]),
    );

    const { headers } = consumeEeRateLimit("user-123", 0);

    expect(headers["X-RateLimit-Remaining"]).toBe(
      String(EE_RATE_LIMIT_MAX_REQUESTS - 2),
    );
  });

  it("does not spend a slot when the URL is already cached", async () => {
    const items = [{ name: "anaseca", year: "2024-12" }];
    await POST(createMapUrlsRequest(items));
    clearEeRateLimit();

    await POST(createMapUrlsRequest(items));
    const { headers } = consumeEeRateLimit("user-123", 0);

    expect(headers["X-RateLimit-Remaining"]).toBe(
      String(EE_RATE_LIMIT_MAX_REQUESTS),
    );
    expect(mockedGetEarthEngineUrl).toHaveBeenCalledTimes(1);
  });

  // Regressão: uma chamada em voo não é um miss novo. Tratá-la como recusa por
  // limite fazia a segunda pergunta pelas camadas `pending` voltar
  // "rate_limited", e o relatório perdia mais da metade dos mapas.
  it("does not answer rate_limited for a call already in flight", async () => {
    consumeEeRateLimit("user-123", EE_RATE_LIMIT_MAX_REQUESTS);
    let resolveUrl: ((url: string) => void) | undefined;
    mockedGetEarthEngineUrl.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveUrl = resolve;
        }),
    );
    clearEeRateLimit();
    const items = [{ name: "anaseca", year: "2024-12" }];
    const first = POST(createMapUrlsRequest(items));
    await vi.waitFor(() => expect(resolveUrl).toBeDefined());

    consumeEeRateLimit("user-123", EE_RATE_LIMIT_MAX_REQUESTS);
    const second = POST(createMapUrlsRequest(items));
    resolveUrl!("https://tiles.example/anaseca");
    const [, secondResponse] = await Promise.all([first, second]);

    expect(await readMaps(secondResponse)).toEqual([
      {
        name: "anaseca",
        year: "2024-12",
        url: "https://tiles.example/anaseca",
      },
    ]);
  });

  it("marks what did not fit in the window instead of dropping the batch", async () => {
    consumeEeRateLimit("user-123", EE_RATE_LIMIT_MAX_REQUESTS - 1);

    const res = await POST(
      createMapUrlsRequest([
        { name: "anaseca", year: "2024-12" },
        { name: "deg", year: "2024-12" },
      ]),
    );
    const maps = await readMaps(res);

    expect(maps[0].url).toBeTruthy();
    expect(maps[1]).toEqual({
      name: "deg",
      year: "2024-12",
      status: "rate_limited",
    });
  });

  // Vinte camadas frias custam ~13 s de Earth Engine. Segurar tudo isso numa
  // requisição só a deixaria à mercê do timeout do proxy, e aí o relatório
  // inteiro ficaria sem mapa de uma vez.
  it("answers pending instead of holding the request past the deadline", async () => {
    vi.useFakeTimers();
    mockedGetEarthEngineUrl.mockImplementation(() => new Promise(() => {}));

    const responsePromise = POST(
      createMapUrlsRequest([
        { name: "anaseca", year: "2024-12" },
        { name: "deg", year: "2026-05" },
      ]),
    );
    await vi.advanceTimersByTimeAsync(EE_MAP_URLS_DEADLINE_MS + 10);
    const maps = await readMaps(await responsePromise);

    expect(maps).toEqual([
      { name: "anaseca", year: "2024-12", status: "pending" },
      // Quem já tinha resposta pronta não espera o relógio.
      { name: "deg", year: "2026-05", status: "year_not_found" },
    ]);
    vi.useRealTimers();
  });

  // A segunda pergunta sobre a mesma camada entra na chamada que já está em
  // voo: sem isso, insistir nas pendentes esgotaria o limite do usuário.
  it("does not spend a slot on an Earth Engine call already in flight", async () => {
    let resolveUrl: ((url: string) => void) | undefined;
    mockedGetEarthEngineUrl.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveUrl = resolve;
        }),
    );
    const items = [{ name: "anaseca", year: "2024-12" }];

    const first = POST(createMapUrlsRequest(items));
    await vi.waitFor(() => expect(resolveUrl).toBeDefined());
    const second = POST(createMapUrlsRequest(items));

    resolveUrl!("https://tiles.example/anaseca");
    const [, secondResponse] = await Promise.all([first, second]);
    const { headers } = consumeEeRateLimit("user-123", 0);

    // A segunda resposta traz a URL, e não um "rate_limited".
    expect(await readMaps(secondResponse)).toEqual([
      {
        name: "anaseca",
        year: "2024-12",
        url: "https://tiles.example/anaseca",
      },
    ]);
    expect(headers["X-RateLimit-Remaining"]).toBe(
      String(EE_RATE_LIMIT_MAX_REQUESTS - 1),
    );
    expect(mockedGetEarthEngineUrl).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed body", async () => {
    const res = await POST(createMapUrlsRequest("todas"));

    expect(res.status).toBe(400);
    expect(mockedGetEarthEngineUrl).not.toHaveBeenCalled();
  });
});
