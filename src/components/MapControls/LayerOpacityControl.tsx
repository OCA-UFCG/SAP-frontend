"use client";

import { useTranslations } from "next-intl";
import { MAP_CONTROL_LABEL_CLASS, MapControlCard } from "./MapControlCard";

interface LayerOpacityControlProps {
  opacity: number;
  onChange: (opacity: number) => void;
}

export function LayerOpacityControl({
  opacity,
  onChange,
}: LayerOpacityControlProps) {
  const t = useTranslations("PlatformMap");

  return (
    <MapControlCard ariaLabel={t("opacity")}>
      <div className="flex items-center gap-2">
        <span className={`${MAP_CONTROL_LABEL_CLASS} w-[66px] shrink-0`}>
          {t("opacity")}
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          aria-label={t("opacity")}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-[40px] bg-[#F1F5F9] [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#989F43] [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-[40px] [&::-moz-range-track]:bg-[#F1F5F9] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#989F43] [&::-webkit-slider-thumb]:bg-white"
        />
        <span className={`${MAP_CONTROL_LABEL_CLASS} w-7 shrink-0 text-right`}>
          {Math.round(opacity * 100)}%
        </span>
      </div>
    </MapControlCard>
  );
}
