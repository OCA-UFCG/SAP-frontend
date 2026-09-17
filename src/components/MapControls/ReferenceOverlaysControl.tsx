"use client";

import { useTranslations } from "next-intl";
import {
  REFERENCE_LAYER_IDS,
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
                className="h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-[3px] border border-[#C4C4C4] bg-white transition-colors checked:border-[#989F43] checked:bg-[#989F43] relative
                        after:content-[''] after:absolute after:inset-0 after:flex after:items-center after:justify-center
                        checked:after:content-['✓'] after:text-[10px] after:font-bold after:text-white after:leading-none after:text-center"
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
