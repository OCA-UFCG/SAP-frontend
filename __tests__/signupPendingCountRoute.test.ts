import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireCatalogAccessMock, countMock } = vi.hoisted(() => ({
  requireCatalogAccessMock: vi.fn(),
  countMock: vi.fn(),
}));

vi.mock("@/app/api/index-catalog/http", () => ({
  requireCatalogAccess: requireCatalogAccessMock,
}));
vi.mock("@/lib/access-requests", () => ({
  countPendingAccessRequests: countMock,
}));

import { GET } from "@/app/api/signup/pending-count/route";

const request = () =>
  new Request("https://sap.example/api/signup/pending-count");

describe("GET /api/signup/pending-count", () => {
  beforeEach(() => {
    requireCatalogAccessMock
      .mockReset()
      .mockResolvedValue({ email: "oca@gmail.com" });
    countMock.mockReset().mockResolvedValue(4);
  });

  it("tells an operator how many requests are waiting", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ count: 4 });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("tells nothing to someone who is not an operator", async () => {
    requireCatalogAccessMock.mockResolvedValue({
      response: NextResponse.json({ error: "sem acesso" }, { status: 403 }),
    });

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(countMock).not.toHaveBeenCalled();
  });

  it("answers with an error instead of a wrong number when counting fails", async () => {
    countMock.mockRejectedValue(new Error("índice ausente"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(request());

    expect(response.status).toBe(500);
  });
});
