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

interface ReferenceOverlaysControlProps {
  activeOverlays: ReadonlySet<ReferenceLayerId>;
  onToggle: (layerId: ReferenceLayerId) => void;
}

export function ReferenceOverlaysControl({
  activeOverlays,
  onToggle,
}: ReferenceOverlaysControlProps) {
  const t = useTranslations("PlatformMap");

  return (
    <MapControlDisclosure label={t("referenceOverlays")}>
      {() => (
        <div className="flex flex-col gap-1.5">
          {REFERENCE_LAYER_IDS.map((layerId) => (
            <label
              key={layerId}
              className="flex cursor-pointer items-center gap-3"
            >
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
