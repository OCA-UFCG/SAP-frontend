"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  REFERENCE_LAYER_IDS,
  type ReferenceLayerId,
} from "@/components/MapLayerContext/mapLayerState";

interface ReferenceOverlaysControlProps {
  activeOverlays: ReadonlySet<ReferenceLayerId>;
  onToggle: (layerId: ReferenceLayerId) => void;
}

export function ReferenceOverlaysControl({
  activeOverlays,
  onToggle,
}: ReferenceOverlaysControlProps) {
  const t = useTranslations("PlatformMap");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="box-border flex w-[302px] shrink-0 flex-col gap-2.5 self-stretch rounded-lg border border-[#EFEFEF] bg-white px-4 py-3"
      role="group"
      aria-label={t("referenceOverlays")}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between outline-none"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="font-open-sans text-[10px] font-semibold leading-[18px] tracking-[-0.006em] text-[#292829]">
          {t("referenceOverlays")}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        >
          <path
            d="M4 10L8 6L12 10"
            stroke="#292829"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="flex flex-col gap-1.5 mt-1">
          {REFERENCE_LAYER_IDS.map((layerId) => (
            <label
              key={layerId}
              className="flex cursor-pointer items-center gap-2"
            >
              <input
                type="checkbox"
                checked={activeOverlays.has(layerId)}
                onChange={() => onToggle(layerId)}
                className="h-3.5 w-3.5 shrink-0 cursor-pointer appearance-none rounded-[3px] border border-[#C4C4C4] bg-white transition-colors checked:border-[#989F43] checked:bg-[#989F43] relative
                        after:content-[''] after:absolute after:inset-0 after:flex after:items-center after:justify-center
                        checked:after:content-['✓'] after:text-[9px] after:font-bold after:text-white after:leading-none after:text-center"
              />
              <span className="font-open-sans text-[10px] font-normal leading-[16px] text-[#292829] select-none">
                {t(layerId)}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
