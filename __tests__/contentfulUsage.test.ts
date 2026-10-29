import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CONTENTFUL_USAGE_TTL_MS,
  getContentfulUsage,
  resetContentfulUsage,
  summarizeUsage,
} from "@/infrastructure/contentful/usage";

const NOW = Date.parse("2026-10-29T15:00:00Z");

const usageResponse = {
  items: [
    {
      metric: "gql",
      usagePerDay: {
        "2026-09-30": 9999,
        "2026-10-01": 1000,
        "2026-10-22": 4000,
        "2026-10-23": 4000,
        "2026-10-24": 4000,
        "2026-10-25": 4000,
        "2026-10-26": 4000,
        "2026-10-27": 4000,
        "2026-10-28": 4000,
        "2026-10-29": 0,
      },
    },
    { metric: "cma", usagePerDay: { "2026-10-28": 700 } },
  ],
};

const fetchMock = vi.fn();

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

beforeEach(() => {
  resetContentfulUsage();
  vi.useFakeTimers({ now: NOW });
  vi.stubEnv("CONTENTFUL_MANAGEMENT_TOKEN", "cma-token");
  vi.stubEnv("NEXT_PUBLIC_CONTENTFUL_SPACE_ID", "space1");
  fetchMock
    .mockReset()
    .mockImplementation(async (url: string) =>
      url.endsWith("/spaces/space1")
        ? json({ sys: { organization: { sys: { id: "org1" } } } })
        : json(usageResponse),
    );
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("summarizeUsage", () => {
  it("adds up only the current month and projects it from the last 7 closed days", () => {
    const usage = summarizeUsage(usageResponse, NOW);

    expect(usage.monthToDate).toEqual({
      gql: 29_000,
      cda: 0,
      cpa: 0,
      cma: 700,
    });
    // 7 dias fechados (22 a 28/10) somam 28.700: 4.100 por dia, e faltam
    // 29, 30 e 31/10.
    expect(usage.projectedMonthTotal).toBe(29_700 + 4_100 * 3);
    expect(usage.limit).toBe(100_000);
  });
});

describe("getContentfulUsage", () => {
  it("asks the organization usage of the month, reaching back 7 days for the projection", async () => {
    await getContentfulUsage();

    const usageUrl = new URL(fetchMock.mock.calls[1][0]);
    expect(usageUrl.pathname).toBe(
      "/organizations/org1/organization_periodic_usages",
    );
    expect(usageUrl.searchParams.get("dateRange.startAt")).toBe("2026-10-01");
    expect(usageUrl.searchParams.get("dateRange.endAt")).toBe("2026-10-29");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(
      "Bearer cma-token",
    );
  });

  it("reads at most once an hour, since each read counts in the same quota", async () => {
    await getContentfulUsage();
    await getContentfulUsage();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(CONTENTFUL_USAGE_TTL_MS + 1);
    await getContentfulUsage();
    // A organização já é conhecida: só o uso é lido de novo.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("keeps the last reading when Contentful fails, without retrying on every scrape", async () => {
    const first = await getContentfulUsage();
    fetchMock.mockResolvedValue(new Response("", { status: 503 }));

    await vi.advanceTimersByTimeAsync(CONTENTFUL_USAGE_TTL_MS + 1);
    expect(await getContentfulUsage()).toEqual(first);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await getContentfulUsage()).toEqual(first);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("returns null when it never managed to read", async () => {
    vi.stubEnv("CONTENTFUL_MANAGEMENT_TOKEN", "");

    expect(await getContentfulUsage()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
