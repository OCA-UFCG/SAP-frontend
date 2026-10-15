import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ReferenceTerritory } from "@/components/MapControls/referenceTerritories";
import {
  normalizeTerritorySearch,
  resolveClickedTerritory,
} from "@/components/MapControls/referenceTerritories";

const territory = (
  name: string,
  uf: string,
  bounds: ReferenceTerritory["bounds"],
): ReferenceTerritory => ({
  layerId: "terras_indigenas",
  name,
  uf,
  municipality: "",
  bounds,
  normalizedName: normalizeTerritorySearch(name),
  searchText: normalizeTerritorySearch(name),
});

const BURITI_MS = territory("Buriti", "MS", [-55.4, -20.8, -55.1, -20.5]);
const BURITI_RO = territory("Buriti", "RO", [-64.0, -11.0, -63.5, -10.5]);
const KIRIRI = territory("Kiriri", "BA", [-38.8, -10.6, -38.5, -10.3]);

const loadReferenceTerritories = vi.hoisted(() => vi.fn());
vi.mock(
  "@/components/MapControls/referenceTerritories",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    loadReferenceTerritories,
  }),
);

import { useTerritoryFocus } from "@/components/PlatformMap/useTerritoryFocus";

describe("resolveClickedTerritory", () => {
  it("entre nomes repetidos, fica com o que contém o ponto clicado", () => {
    const resolved = resolveClickedTerritory([BURITI_MS, BURITI_RO, KIRIRI], {
      layerId: "terras_indigenas",
      name: "Buriti",
      lngLat: [-63.8, -10.8],
    });

    expect(resolved).toBe(BURITI_RO);
  });

  it("sem o nome na lista, marca o território só com o nome e o ponto", () => {
    const resolved = resolveClickedTerritory([KIRIRI], {
      layerId: "terras_indigenas",
      name: "Nova",
      lngLat: [-50, -5],
    });

    expect(resolved).toMatchObject({
      layerId: "terras_indigenas",
      name: "Nova",
      bounds: [-50, -5, -50, -5],
    });
  });
});

describe("useTerritoryFocus", () => {
  const activeTi = new Set(["terras_indigenas" as const]);

  it("o clique marca o território sem mover o mapa", async () => {
    loadReferenceTerritories.mockResolvedValue([KIRIRI]);
    const { result } = renderHook(() => useTerritoryFocus(activeTi, vi.fn()));

    act(() =>
      result.current.selectClickedTerritory({
        layerId: "terras_indigenas",
        name: "Kiriri",
        lngLat: [-38.6, -10.4],
      }),
    );

    await waitFor(() =>
      expect(result.current.territoryFocus?.territory).toBe(KIRIRI),
    );
    expect(result.current.territoryFocus?.moveMap).toBe(false);
  });

  it("a busca move o mapa e vence um clique que ainda esperava a lista", async () => {
    let resolveList: (territories: ReferenceTerritory[]) => void = () => {};
    loadReferenceTerritories.mockReturnValue(
      new Promise((resolve) => (resolveList = resolve)),
    );
    const { result } = renderHook(() => useTerritoryFocus(activeTi, vi.fn()));

    act(() =>
      result.current.selectClickedTerritory({
        layerId: "terras_indigenas",
        name: "Kiriri",
        lngLat: [-38.6, -10.4],
      }),
    );
    act(() => result.current.focusTerritory(BURITI_MS));
    await act(async () => resolveList([KIRIRI]));

    expect(result.current.territoryFocus?.territory).toBe(BURITI_MS);
    expect(result.current.territoryFocus?.moveMap).toBe(true);
  });
});
