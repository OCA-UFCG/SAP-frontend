"use client";

import { useCallback, useState } from "react";
import type { ReferenceLayerId } from "@/components/MapLayerContext/mapLayerState";
import type {
  ReferenceTerritory,
  TerritoryBounds,
} from "@/components/MapControls/referenceTerritories";

/**
 * Para onde o mapa deve ir depois de uma busca de território. `key` muda a cada
 * escolha, para que buscar de novo o mesmo território — depois de a pessoa ter
 * arrastado o mapa para longe — volte a mover a câmera.
 */
export interface TerritoryFocus {
  bounds: TerritoryBounds;
  key: number;
}

/**
 * Escolher um território na busca liga a camada dele, se estiver desligada, e
 * leva o mapa até ele. Sem ligar a camada a pessoa chegaria num pedaço de mapa
 * sem nenhum contorno para mostrar onde está o território.
 */
export function useTerritoryFocus(
  activeOverlays: ReadonlySet<ReferenceLayerId>,
  toggleOverlay: (layerId: ReferenceLayerId) => void,
) {
  const [territoryFocus, setTerritoryFocus] = useState<TerritoryFocus | null>(
    null,
  );

  const focusTerritory = useCallback(
    (territory: ReferenceTerritory) => {
      if (!activeOverlays.has(territory.layerId)) {
        toggleOverlay(territory.layerId);
      }
      setTerritoryFocus((current) => ({
        bounds: territory.bounds,
        key: (current?.key ?? 0) + 1,
      }));
    },
    [activeOverlays, toggleOverlay],
  );

  return { territoryFocus, focusTerritory };
}
