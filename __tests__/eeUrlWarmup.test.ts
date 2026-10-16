import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayers: vi.fn().mockResolvedValue([]),
}));

import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import { CACHE_TTL_MS } from "@/app/api/ee/cache";

function resetWarmupFlag() {
  delete (globalThis as { __sapEeUrlWarmupStarted?: boolean })
    .__sapEeUrlWarmupStarted;
}

beforeEach(() => {
  resetWarmupFlag();
  vi.useFakeTimers();
  vi.mocked(getPanelLayers).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  resetWarmupFlag();
});

describe("renovação dos endereços de tiles", () => {
  // Regressão: a renovação era a cada 12 h e o endereço vale 30 min, então em
  // quase todo o dia o primeiro clique numa camada esperava o Earth Engine.
  it("renova antes de o endereço guardado vencer", async () => {
    const { ensureEeCacheWarmupStarted, EE_URL_REFRESH_MS } =
      await import("@/app/api/ee/services");

    ensureEeCacheWarmupStarted();
    await vi.advanceTimersByTimeAsync(0);
    expect(getPanelLayers).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(EE_URL_REFRESH_MS);
    expect(getPanelLayers).toHaveBeenCalledTimes(2);
    expect(EE_URL_REFRESH_MS).toBeLessThan(CACHE_TTL_MS);
  });

  // A subida do servidor e cada rota recebem a sua cópia do módulo: sem a trava
  // compartilhada, cada uma abriria uma renovação própria.
  it("começa uma vez só, mesmo chamada de outra cópia do módulo", async () => {
    const startup = await import("@/app/api/ee/services");
    startup.ensureEeCacheWarmupStarted();

    vi.resetModules();
    const routeCopy = await import("@/app/api/ee/services");
    routeCopy.ensureEeCacheWarmupStarted();
    await vi.advanceTimersByTimeAsync(startup.EE_URL_REFRESH_MS);

    expect(getPanelLayers).toHaveBeenCalledTimes(2);
  });
});
