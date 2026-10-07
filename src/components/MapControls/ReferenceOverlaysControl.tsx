"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import {
  REFERENCE_LAYER_IDS,
  REFERENCE_LAYER_SWATCHES,
  type ReferenceLayerId,
} from "@/components/MapLayerContext/mapLayerState";
import {
  MAP_CONTROL_LABEL_CLASS,
  MapControlDisclosure,
} from "./MapControlCard";
import type { ReferenceTerritory } from "./referenceTerritories";
import { TerritorySearch } from "./TerritorySearch";

interface ReferenceOverlaysControlProps {
  activeOverlays: ReadonlySet<ReferenceLayerId>;
  onToggle: (layerId: ReferenceLayerId) => void;
  highlightedOverlay: ReferenceLayerId | null;
  onToggleHighlight: (layerId: ReferenceLayerId) => void;
  onSelectTerritory: (territory: ReferenceTerritory) => void;
  /** O cartão foi aberto: a pessoa provavelmente vai mexer em territórios. */
  onOpen?: () => void;
}

export function ReferenceOverlaysControl({
  activeOverlays,
  onToggle,
  highlightedOverlay,
  onToggleHighlight,
  onSelectTerritory,
  onOpen,
}: ReferenceOverlaysControlProps) {
  const t = useTranslations("PlatformMap");

  return (
    <MapControlDisclosure label={t("referenceOverlays")} onOpen={onOpen}>
      {() => (
        <div className="flex flex-col gap-1.5">
          <TerritorySearch
            activeOverlays={activeOverlays}
            onSelect={onSelectTerritory}
          />
          <span
            aria-hidden="true"
            className={`${MAP_CONTROL_LABEL_CLASS} self-end text-[#6B6B6B]`}
          >
            {t("highlightColumn")}
          </span>
          {REFERENCE_LAYER_IDS.map((layerId) => (
            <div key={layerId} className="flex items-center gap-3">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={activeOverlays.has(layerId)}
                  onChange={() => onToggle(layerId)}
                  style={swatchStyle(layerId)}
                  className="relative h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-[3px] border-[1.5px] border-(--swatch-outline) bg-[color-mix(in_srgb,var(--swatch-fill)_22%,white)] transition-colors checked:bg-(--swatch-fill)
                        focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--swatch-outline)
                        after:absolute after:inset-0 after:flex after:items-center after:justify-center after:content-['']
                        checked:after:content-['✓'] after:text-center after:text-[10px] after:font-bold after:leading-none after:text-(--swatch-check)"
                />
                <span className={`${MAP_CONTROL_LABEL_CLASS} select-none`}>
                  {t(layerId)}
                </span>
              </label>
              <HighlightSwitch
                layerId={layerId}
                checked={highlightedOverlay === layerId}
                label={t("highlightTerritory", { name: t(layerId) })}
                onToggle={onToggleHighlight}
              />
            </div>
          ))}
        </div>
      )}
    </MapControlDisclosure>
  );
}

// O checkbox é uma amostra do território: borda na cor do contorno e interior
// na cor do preenchimento — claro quando desligado, cheio quando ligado.
function swatchStyle(layerId: ReferenceLayerId): CSSProperties {
  const swatch = REFERENCE_LAYER_SWATCHES[layerId];
  return {
    "--swatch-outline": swatch.outline,
    "--swatch-fill": swatch.fill,
    "--swatch-check": swatch.check,
  } as CSSProperties;
}

/**
 * O liga/desliga do destaque: deixa só os territórios deste grupo acesos e
 * escurece o resto do mapa. É um `switch`, e não outro checkbox, para o leitor
 * de tela anunciar "ligado/desligado" e para não se confundir com o checkbox
 * que mostra o grupo.
 */
function HighlightSwitch({
  layerId,
  checked,
  label,
  onToggle,
}: {
  layerId: ReferenceLayerId;
  checked: boolean;
  label: string;
  onToggle: (layerId: ReferenceLayerId) => void;
}) {
  const swatch = REFERENCE_LAYER_SWATCHES[layerId];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={() => onToggle(layerId)}
      style={{ "--swatch-outline": swatch.outline } as CSSProperties}
      className={`relative h-4 w-7 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--swatch-outline) ${
        checked ? "bg-(--swatch-outline)" : "bg-[#E4E5E2]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-150 ${
          checked ? "translate-x-3" : "translate-x-0"
        }`}
      />
    </button>
  );
}
