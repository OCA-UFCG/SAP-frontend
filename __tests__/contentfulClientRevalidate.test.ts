import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getContent } from "@/infrastructure/contentful/client";

describe("getContent revalidate", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("CONTENTFUL_SPACE_ID", "space");
    vi.stubEnv("CONTENTFUL_ACCESS_TOKEN", "token");
    vi.stubEnv("CONTENTFUL_PREVIEW", "false");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  const revalidateOfLastCall = () => fetchMock.mock.calls.at(-1)?.[1]?.next;

  it("keeps one hour when the variable is not set (production)", async () => {
    await getContent("{ x }");
    expect(revalidateOfLastCall()).toEqual({ revalidate: 3600 });
  });

  it("uses the seconds from CONTENTFUL_REVALIDATE_SECONDS (beta)", async () => {
    vi.stubEnv("CONTENTFUL_REVALIDATE_SECONDS", "10");
    await getContent("{ x }");
    expect(revalidateOfLastCall()).toEqual({ revalidate: 10 });
  });

  it("ignores an invalid value", async () => {
    vi.stubEnv("CONTENTFUL_REVALIDATE_SECONDS", "abc");
    await getContent("{ x }");
    expect(revalidateOfLastCall()).toEqual({ revalidate: 3600 });
  });

  it("does not override a query that sets its own cache", async () => {
    vi.stubEnv("CONTENTFUL_REVALIDATE_SECONDS", "10");
    await getContent("{ x }", {}, { next: { revalidate: 3600, tags: ["t"] } });
    expect(revalidateOfLastCall()).toEqual({ revalidate: 3600, tags: ["t"] });
  });
});
