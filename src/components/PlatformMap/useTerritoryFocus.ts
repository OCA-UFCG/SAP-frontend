"use client";

import { useCallback, useRef, useState } from "react";
import type { ReferenceLayerId } from "@/components/MapLayerContext/mapLayerState";
import {
  loadReferenceTerritories,
  resolveClickedTerritory,
  type ReferenceTerritory,
  type ReferenceTerritoryClick,
  type TerritoryBounds,
} from "@/components/MapControls/referenceTerritories";

/**
 * Para onde o mapa deve ir depois de uma busca de território. `key` muda a cada
 * escolha, para que buscar de novo o mesmo território — depois de a pessoa ter
 * arrastado o mapa para longe — volte a mover a câmera. `territory` é o que o
 * cartão de Territórios mostra como selecionado.
 */
export interface TerritoryFocus {
  territory: ReferenceTerritory;
  bounds: TerritoryBounds;
  key: number;
  /** Falso quando o território foi clicado no mapa: ele já está à vista. */
  moveMap: boolean;
}

/**
 * Escolher um território na busca leva o mapa até ele. Com alguma camada ligada
 * a busca só mostra territórios dela; com todas desligadas ela mostra todos, e
 * aí a camada do escolhido é ligada — senão a pessoa chegaria num pedaço de
 * mapa sem nenhum contorno para mostrar onde está o território.
 */
export function useTerritoryFocus(
  activeOverlays: ReadonlySet<ReferenceLayerId>,
  toggleOverlay: (layerId: ReferenceLayerId) => void,
) {
  const [territoryFocus, setTerritoryFocus] = useState<TerritoryFocus | null>(
    null,
  );
  // O clique espera a lista de territórios chegar; uma escolha feita depois
  // dele (outro clique, a busca, o "×") vence a que ainda está esperando.
  const choiceRef = useRef(0);

  const markTerritory = useCallback(
    (territory: ReferenceTerritory, moveMap: boolean) => {
      choiceRef.current += 1;
      setTerritoryFocus((current) => ({
        territory,
        bounds: territory.bounds,
        key: (current?.key ?? 0) + 1,
        moveMap,
      }));
    },
    [],
  );

  const focusTerritory = useCallback(
    (territory: ReferenceTerritory) => {
      if (!activeOverlays.has(territory.layerId)) {
        toggleOverlay(territory.layerId);
      }
      markTerritory(territory, true);
    },
    [activeOverlays, toggleOverlay, markTerritory],
  );

  /**
   * Clicar num território do mapa marca ele no cartão, como a busca, mas sem
   * mover o mapa. UF, município e enquadramento vêm da lista da busca.
   */
  const selectClickedTerritory = useCallback(
    (click: ReferenceTerritoryClick) => {
      const choice = choiceRef.current + 1;
      choiceRef.current = choice;
      void loadReferenceTerritories()
        .catch(() => [])
        .then((territories) => {
          if (choiceRef.current !== choice) return;
          markTerritory(resolveClickedTerritory(territories, click), false);
        });
    },
    [markTerritory],
  );

  // Desmarcar só tira o nome do cartão: o mapa fica onde está.
  const clearTerritoryFocus = useCallback(() => {
    choiceRef.current += 1;
    setTerritoryFocus(null);
  }, []);

  return {
    territoryFocus,
    focusTerritory,
    selectClickedTerritory,
    clearTerritoryFocus,
  };
}
