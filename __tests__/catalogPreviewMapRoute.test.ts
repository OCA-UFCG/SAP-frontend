import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getIdempotencyKey: vi.fn(),
  requireCatalogAccess: vi.fn(),
  runCatalogIdempotently: vi.fn(),
  saveIndexCatalogPreviewMap: vi.fn(),
}));

vi.mock("@/services/indexCatalog/previewMapService", () => ({
  saveIndexCatalogPreviewMap: mocks.saveIndexCatalogPreviewMap,
}));
vi.mock("@/services/indexCatalog/idempotency", () => ({
  getIdempotencyKey: mocks.getIdempotencyKey,
  runCatalogIdempotently: mocks.runCatalogIdempotently,
}));
vi.mock("@/app/api/index-catalog/http", () => ({
  requireCatalogAccess: mocks.requireCatalogAccess,
  readJsonBody: (request: Request) => request.json(),
  noStoreJson: (value: unknown, status = 200) =>
    Response.json(value, { status }),
  catalogErrorResponse: (error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    ),
}));

import { POST } from "@/app/api/index-catalog/drafts/[entryId]/preview-map/route";

function previewMapRequest(body: unknown) {
  return new Request(
    "https://sap.example/api/index-catalog/drafts/entry-1/preview-map",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "preview-map-request-key",
      },
      body: JSON.stringify(body),
    },
  );
}

const context = { params: Promise.resolve({ entryId: "entry-1" }) };

describe("catalog preview map route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCatalogAccess.mockResolvedValue({
      user: { uid: "admin", email: "admin@example.test" },
    });
    mocks.getIdempotencyKey.mockReturnValue("preview-map-request-key");
    mocks.runCatalogIdempotently.mockImplementation(
      (_scope: string, _key: string, operation: () => Promise<unknown>) =>
        operation(),
    );
  });

  it("saves the captured image through an idempotent operation", async () => {
    mocks.saveIndexCatalogPreviewMap.mockResolvedValue({
      entryId: "entry-1",
      panelLayerId: "indice-aridez",
      assetId: "asset-1",
      url: "https://images/previa.png",
      requiresRepublish: false,
    });

    const response = await POST(
      previewMapRequest({ image: "data:image/png;base64,AAAA" }),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ url: "https://images/previa.png" }),
    );
    expect(mocks.runCatalogIdempotently).toHaveBeenCalledWith(
      "preview-map:entry-1",
      "preview-map-request-key",
      expect.any(Function),
    );
    expect(mocks.saveIndexCatalogPreviewMap).toHaveBeenCalledWith(
      "entry-1",
      "data:image/png;base64,AAAA",
      { uid: "admin", email: "admin@example.test" },
    );
  });

  it("never reaches the service without catalog access", async () => {
    mocks.requireCatalogAccess.mockResolvedValue({
      response: Response.json(
        { error: "Sessão não autenticada." },
        {
          status: 401,
        },
      ),
    });

    const response = await POST(previewMapRequest({ image: "x" }), context);

    expect(response.status).toBe(401);
    expect(mocks.saveIndexCatalogPreviewMap).not.toHaveBeenCalled();
  });

  it("turns a rejected capture into an error response", async () => {
    mocks.saveIndexCatalogPreviewMap.mockRejectedValue(
      new Error("Imagem de prévia inválida: informe uma data URL"),
    );

    const response = await POST(previewMapRequest({ image: 42 }), context);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Imagem de prévia inválida: informe uma data URL",
    });
  });
});
