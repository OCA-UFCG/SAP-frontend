import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReferenceLayerId } from "@/components/MapLayerContext/mapLayerState";
import {
  clearReferenceOverlayUrlCache,
  useReferenceOverlayTileLayers,
} from "@/components/PlatformMap/useReferenceOverlayTileLayers";

class FakeReferenceLayerApi {
  calls: string[] = [];
  private deferred: Array<(url: string | null) => void> = [];

  constructor(private readonly mode: "immediate" | "deferred" = "immediate") {}

  readonly fetch = vi.fn(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const layer = new URL(String(input), "http://localhost").searchParams.get(
        "layer",
      );
      this.calls.push(String(layer));

      if (this.mode === "immediate") {
        return Promise.resolve(this.okResponse(`https://tiles/${layer}`));
      }

      return new Promise<Response>((resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
        this.deferred.push((url) =>
          resolve(url ? this.okResponse(url) : this.errorResponse()),
        );
      });
    },
  );

  resolvePending(url: string | null) {
    this.deferred.shift()?.(url);
  }

  private okResponse(url: string) {
    return { ok: true, status: 200, json: async () => ({ url }) } as Response;
  }

  private errorResponse() {
    return {
      ok: false,
      status: 429,
      json: async () => ({ error: "Too many Earth Engine requests." }),
    } as Response;
  }
}

function overlaySet(...ids: ReferenceLayerId[]) {
  return new Set<ReferenceLayerId>(ids);
}

beforeEach(() => {
  clearReferenceOverlayUrlCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useReferenceOverlayTileLayers", () => {
  it("resolves the tile URL of each active overlay", async () => {
    const api = new FakeReferenceLayerApi();
    vi.stubGlobal("fetch", api.fetch);

    const { result } = renderHook(() =>
      useReferenceOverlayTileLayers(overlaySet("quilombolas")),
    );

    expect(result.current.get("quilombolas")?.status).toBe("loading");
    await waitFor(() =>
      expect(result.current.get("quilombolas")).toEqual({
        status: "ready",
        tileUrl: "https://tiles/quilombolas",
      }),
    );
  });

  it("drops deactivated overlays from the returned map", async () => {
    const api = new FakeReferenceLayerApi();
    vi.stubGlobal("fetch", api.fetch);

    const { result, rerender } = renderHook(
      ({ overlays }) => useReferenceOverlayTileLayers(overlays),
      { initialProps: { overlays: overlaySet("quilombolas") } },
    );

    await waitFor(() =>
      expect(result.current.get("quilombolas")?.status).toBe("ready"),
    );
    rerender({ overlays: overlaySet() });

    expect(result.current.size).toBe(0);
  });

  it("reuses the cached URL instead of spending another rate-limited request", async () => {
    const api = new FakeReferenceLayerApi();
    vi.stubGlobal("fetch", api.fetch);

    const { result, rerender } = renderHook(
      ({ overlays }) => useReferenceOverlayTileLayers(overlays),
      { initialProps: { overlays: overlaySet("assentamentos") } },
    );
    await waitFor(() =>
      expect(result.current.get("assentamentos")?.status).toBe("ready"),
    );

    rerender({ overlays: overlaySet() });
    rerender({ overlays: overlaySet("assentamentos") });

    await waitFor(() =>
      expect(result.current.get("assentamentos")?.tileUrl).toBe(
        "https://tiles/assentamentos",
      ),
    );
    expect(api.calls).toEqual(["assentamentos"]);
  });

  // O servidor descarta a URL de tiles depois de 30 min porque o mapid do GEE
  // expira; um cache de cliente eterno serviria tiles que já morreram.
  it("refetches once the cached URL is older than the server cache TTL", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = new FakeReferenceLayerApi();
    vi.stubGlobal("fetch", api.fetch);

    const { result, rerender } = renderHook(
      ({ overlays }) => useReferenceOverlayTileLayers(overlays),
      { initialProps: { overlays: overlaySet("terras_indigenas") } },
    );
    await waitFor(() =>
      expect(result.current.get("terras_indigenas")?.status).toBe("ready"),
    );

    rerender({ overlays: overlaySet() });
    await act(async () => {
      vi.advanceTimersByTime(1000 * 60 * 26);
    });
    rerender({ overlays: overlaySet("terras_indigenas") });

    await waitFor(() =>
      expect(api.calls).toEqual(["terras_indigenas", "terras_indigenas"]),
    );
  });

  // Regressão: o controller resolvido ficava registrado como "requisição em
  // voo", e depois de um erro a camada nunca mais era buscada.
  it("retries a layer whose previous request failed", async () => {
    const api = new FakeReferenceLayerApi("deferred");
    vi.stubGlobal("fetch", api.fetch);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { result, rerender } = renderHook(
      ({ overlays }) => useReferenceOverlayTileLayers(overlays),
      { initialProps: { overlays: overlaySet("quilombolas") } },
    );

    await act(async () => api.resolvePending(null));
    await waitFor(() =>
      expect(result.current.get("quilombolas")?.status).toBe("error"),
    );

    rerender({ overlays: overlaySet() });
    rerender({ overlays: overlaySet("quilombolas") });
    await act(async () => api.resolvePending("https://tiles/quilombolas"));

    await waitFor(() =>
      expect(result.current.get("quilombolas")?.status).toBe("ready"),
    );
    expect(api.calls).toEqual(["quilombolas", "quilombolas"]);
  });

  it("aborts the in-flight request of an overlay turned off mid-flight", async () => {
    const api = new FakeReferenceLayerApi("deferred");
    vi.stubGlobal("fetch", api.fetch);

    const { result, rerender } = renderHook(
      ({ overlays }) => useReferenceOverlayTileLayers(overlays),
      { initialProps: { overlays: overlaySet("unidades_conservacao") } },
    );
    expect(result.current.get("unidades_conservacao")?.status).toBe("loading");

    rerender({ overlays: overlaySet() });
    await act(async () => api.resolvePending("https://tiles/late"));

    expect(result.current.size).toBe(0);
  });
});
