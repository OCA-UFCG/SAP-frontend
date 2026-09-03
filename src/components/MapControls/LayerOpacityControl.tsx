"use client";

import { useTranslations } from "next-intl";

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
    <div className="box-border flex h-[50px] w-[302px] shrink-0 flex-col items-center gap-2 self-stretch rounded-lg border border-[#EFEFEF] bg-white p-4">
      <div className="flex h-[18px] w-[270px] shrink-0 items-center justify-center gap-2">
        <span className="h-[18px] w-[66px] shrink-0 font-open-sans text-[10px] font-normal leading-[18px] tracking-[-0.006em] text-[#292829]">
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
          className="h-2 w-[168px] shrink-0 cursor-pointer appearance-none rounded-[40px] bg-[#F1F5F9] [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#989F43] [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-[40px] [&::-moz-range-track]:bg-[#F1F5F9] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#989F43] [&::-webkit-slider-thumb]:bg-white"
        />
        <span className="h-[18px] w-5 shrink-0 font-open-sans text-[10px] font-normal leading-[18px] tracking-[-0.006em] text-[#292829]">
          {Math.round(opacity * 100)}%
        </span>
      </div>
    </div>
  );
}
