import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createIndexCatalogDraft: vi.fn(),
  getIdempotencyKey: vi.fn(),
  requireCatalogAccess: vi.fn(),
  runCatalogIdempotently: vi.fn(),
}));

vi.mock("@/services/indexCatalog/contentfulManagement", () => ({
  listCatalogEntries: vi.fn(),
}));
vi.mock("@/services/indexCatalog/indexCatalogService", () => ({
  createIndexCatalogDraft: mocks.createIndexCatalogDraft,
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

import { POST } from "@/app/api/index-catalog/route";

describe("index catalog create route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCatalogAccess.mockResolvedValue({
      user: { uid: "admin", email: "admin@example.test" },
    });
    mocks.getIdempotencyKey.mockReturnValue("create-request-key");
    mocks.runCatalogIdempotently.mockImplementation(
      (_scope: string, _key: string, operation: () => Promise<unknown>) =>
        operation(),
    );
  });

  it("creates a draft through an idempotent operation", async () => {
    const input = { name: "Pobreza" };
    mocks.createIndexCatalogDraft.mockResolvedValue({
      entryId: "draft-1",
      panelLayerId: "pobreza",
      status: "draft",
    });
    const request = new Request("https://sap.example/api/index-catalog", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "create-request-key",
      },
      body: JSON.stringify(input),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mocks.runCatalogIdempotently).toHaveBeenCalledWith(
      "create:admin",
      "create-request-key",
      expect.any(Function),
    );
    expect(mocks.createIndexCatalogDraft).toHaveBeenCalledWith(input, {
      uid: "admin",
      email: "admin@example.test",
    });
  });
});
