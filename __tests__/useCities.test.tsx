import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalyzePayload } from "@/utils/amfeInterfaces";
import useCities from "@/components/Amfe/useCities";

const payloadFor = (value: string): AnalyzePayload => ({
  criteria: [{ name: "ia_mean", value: 1, is_benefit: true }],
  thresholds: { indifference: 0.1, preference: 0.3, veto: 0.8 },
  model: { version: "1.0" },
  typeScenario: "optimistic",
  ranking: { level: "state" },
  interestArea: { type: "state", value },
});

const responseFor = (city: string, count: number) => ({
  result: { [city]: { name: city, UF: "PB", classification: 1 } },
  count,
  total_count: count,
  excluded_count: 0,
  excluded: {},
});

const Probe = ({ payload }: { payload: AnalyzePayload | null }) => {
  const { cities, coverage, error, loading } = useCities(payload);

  return (
    <output>
      {JSON.stringify({
        codes: Object.keys(cities),
        count: coverage?.count ?? null,
        error,
        loading,
      })}
    </output>
  );
};

const readProbe = () =>
  JSON.parse(screen.getByRole("status").textContent ?? "{}") as {
    codes: string[];
    count: number | null;
    error: string | null;
    loading: boolean;
  };

let resolvers: Array<(value: { ok: boolean; body: unknown }) => void>;

beforeEach(() => {
  resolvers = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((resolve) => {
          resolvers.push(({ ok, body }) =>
            resolve({ ok, json: async () => body }),
          );
        }),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useCities", () => {
  it("ignores a stale response so the map never contradicts the form", async () => {
    const { rerender } = render(<Probe payload={payloadFor("BR")} />);

    rerender(<Probe payload={payloadFor("PB")} />);
    await waitFor(() => expect(resolvers).toHaveLength(2));

    await act(async () => {
      resolvers[1]({ ok: true, body: responseFor("2500106", 223) });
    });
    await act(async () => {
      resolvers[0]({ ok: true, body: responseFor("1100015", 5570) });
    });

    expect(readProbe().codes).toEqual(["2500106"]);
    expect(readProbe().count).toBe(223);
  });

  it("clears the previous result when the analysis fails", async () => {
    const { rerender } = render(<Probe payload={payloadFor("PB")} />);

    await waitFor(() => expect(resolvers).toHaveLength(1));
    await act(async () => {
      resolvers[0]({ ok: true, body: responseFor("2500106", 223) });
    });
    expect(readProbe().codes).toEqual(["2500106"]);

    rerender(<Probe payload={payloadFor("CE")} />);
    await waitFor(() => expect(resolvers).toHaveLength(2));
    await act(async () => {
      resolvers[1]({ ok: false, body: { detail: "peso invalido" } });
    });

    const state = readProbe();
    expect(state.error).toBe("peso invalido");
    expect(state.codes).toEqual([]);
    expect(state.count).toBeNull();
  });

  it("keeps the spinner up while a newer request is still in flight", async () => {
    const { rerender } = render(<Probe payload={payloadFor("BR")} />);

    rerender(<Probe payload={payloadFor("PB")} />);
    await waitFor(() => expect(resolvers).toHaveLength(2));

    await act(async () => {
      resolvers[0]({ ok: true, body: responseFor("1100015", 5570) });
    });

    expect(readProbe().loading).toBe(true);
  });
});
