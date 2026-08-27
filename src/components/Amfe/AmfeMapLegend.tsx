"use client";

import { useTranslations } from "next-intl";
import { CLASSIFICATION_COLORS } from "@/components/Map/classificationLayers";

const PRIORITY_LABEL_KEYS = [
  "priorityVeryLow",
  "priorityLow",
  "priorityMedium",
  "priorityHigh",
  "priorityVeryHigh",
] as const;

const LEGEND_ORDER = [...PRIORITY_LABEL_KEYS.keys()].reverse();

export const AmfeMapLegend = () => {
  const t = useTranslations("Map");

  return (
    <div className="absolute right-4 bottom-4 z-[1000] rounded-lg bg-white/90 p-3 shadow-lg">
      <p className="mb-2 text-xs font-semibold text-[#364153]">
        {t("classification")}
      </p>
      <div className="flex flex-col gap-1">
        {LEGEND_ORDER.map((level) => (
          <div key={level} className="flex items-center gap-2">
            <div
              className="h-4 w-4 rounded border border-[#99a1af]"
              style={{ backgroundColor: CLASSIFICATION_COLORS[level] }}
            />
            <span className="text-xs text-[#364153]">
              {t(PRIORITY_LABEL_KEYS[level])}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
