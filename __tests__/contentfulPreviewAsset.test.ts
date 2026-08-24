import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { saveContentfulPreviewImage } from "@/services/indexCatalog/contentfulAssets";

interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

const PROCESSED_URL = "//images.ctfassets.net/space/asset/previa.png";

/** Reproduz a sequência upload → asset → process → publish do Contentful. */
class FakeContentfulAssetApi {
  readonly requests: RecordedRequest[] = [];
  private processedGets = 0;

  constructor(
    private readonly options: {
      missingAssetId?: string;
      processedAfterGets?: number;
    } = {},
  ) {}

  readonly fetch = async (url: string | URL, init: RequestInit = {}) => {
    const href = String(url);
    const method = init.method ?? "GET";
    this.requests.push({
      url: href,
      method,
      headers: (init.headers ?? {}) as Record<string, string>,
      body: typeof init.body === "string" ? init.body : undefined,
    });

    if (href.startsWith("https://upload.contentful.com")) {
      return Response.json({ sys: { id: "upload-1", type: "Upload" } });
    }

    if (href.endsWith("/process")) {
      return new Response(null, { status: 204 });
    }

    if (href.endsWith("/published")) {
      return Response.json(this.asset(4, PROCESSED_URL));
    }

    if (method === "GET") {
      // Só o asset rastreado desapareceu; o recém-criado responde normalmente.
      if (
        this.options.missingAssetId &&
        href.endsWith(this.options.missingAssetId)
      ) {
        return new Response("not found", { status: 404 });
      }
      this.processedGets += 1;
      const ready =
        this.processedGets >= (this.options.processedAfterGets ?? 1);
      return Response.json(this.asset(3, ready ? PROCESSED_URL : undefined));
    }

    return Response.json(this.asset(2));
  };

  private asset(version: number, fileUrl?: string) {
    return {
      sys: { id: "asset-1", version },
      fields: {
        title: { "en-US": "Prévia do mapa — Índice de Aridez" },
        file: { "en-US": fileUrl ? { url: fileUrl } : {} },
      },
    };
  }
}

const input = {
  bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  contentType: "image/png",
  fileName: "indice-aridez-previa-mapa.png",
  title: "Prévia do mapa — Índice de Aridez",
  locale: "en-US",
};

describe("saveContentfulPreviewImage", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CONTENTFUL_SPACE_ID", "space-teste");
    vi.stubEnv("CONTENTFUL_MANAGEMENT_TOKEN", "token-teste");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("uploads, creates, processes and publishes a new asset", async () => {
    const api = new FakeContentfulAssetApi();
    vi.stubGlobal("fetch", api.fetch);

    const saved = await saveContentfulPreviewImage(input);

    expect(saved).toEqual({
      assetId: "asset-1",
      url: `https:${PROCESSED_URL}`,
    });
    const steps = api.requests.map(
      (request) =>
        `${request.method} ${request.url.replace(/^https:\/\/[^/]+/, "")}`,
    );
    expect(steps).toEqual([
      "POST /spaces/space-teste/uploads",
      "POST /spaces/space-teste/environments/master/assets",
      "PUT /spaces/space-teste/environments/master/assets/asset-1/files/en-US/process",
      "GET /spaces/space-teste/environments/master/assets/asset-1",
      "PUT /spaces/space-teste/environments/master/assets/asset-1/published",
    ]);
    expect(JSON.parse(api.requests[1].body ?? "{}")).toEqual({
      fields: {
        title: { "en-US": input.title },
        file: {
          "en-US": {
            contentType: "image/png",
            fileName: input.fileName,
            uploadFrom: {
              sys: { type: "Link", linkType: "Upload", id: "upload-1" },
            },
          },
        },
      },
    });
  });

  it("reuses the asset already linked to the index", async () => {
    const api = new FakeContentfulAssetApi();
    vi.stubGlobal("fetch", api.fetch);

    await saveContentfulPreviewImage({ ...input, assetId: "asset-1" });

    const updates = api.requests.filter(
      (request) => request.method === "PUT" && request.url.endsWith("/asset-1"),
    );
    expect(updates).toHaveLength(1);
    expect(updates[0].headers["X-Contentful-Version"]).toBe("3");
    expect(
      api.requests.some(
        (request) =>
          request.method === "POST" && request.url.endsWith("/assets"),
      ),
    ).toBe(false);
  });

  it("creates a new asset when the tracked one no longer exists", async () => {
    const api = new FakeContentfulAssetApi({ missingAssetId: "apagado" });
    vi.stubGlobal("fetch", api.fetch);

    await expect(
      saveContentfulPreviewImage({ ...input, assetId: "apagado" }),
    ).resolves.toEqual({ assetId: "asset-1", url: `https:${PROCESSED_URL}` });
    expect(
      api.requests.some(
        (request) =>
          request.method === "POST" && request.url.endsWith("/assets"),
      ),
    ).toBe(true);
  });

  it("waits for the asynchronous file processing before publishing", async () => {
    vi.useFakeTimers();
    const api = new FakeContentfulAssetApi({ processedAfterGets: 3 });
    vi.stubGlobal("fetch", api.fetch);

    const pending = saveContentfulPreviewImage(input);
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(pending).resolves.toEqual({
      assetId: "asset-1",
      url: `https:${PROCESSED_URL}`,
    });
    expect(
      api.requests.filter((request) => request.method === "GET"),
    ).toHaveLength(3);
  });
});
