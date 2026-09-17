"use client";

import { useTranslations } from "next-intl";
import { CLASSIFICATION_COLORS } from "@/components/Map/classificationLayers";
import {
  MAP_CONTROL_LABEL_CLASS,
  MapControlCard,
} from "@/components/MapControls/MapControlCard";

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
    <MapControlCard ariaLabel={t("classification")}>
      <p className={`${MAP_CONTROL_LABEL_CLASS} font-semibold`}>
        {t("classification")}
      </p>
      <div className="flex flex-col gap-1.5">
        {LEGEND_ORDER.map((level) => (
          <div key={level} className="flex items-center gap-3">
            <div
              className="h-4 w-4 shrink-0 rounded-full border border-[#C4C4C4]"
              style={{ backgroundColor: CLASSIFICATION_COLORS[level] }}
            />
            <span className={MAP_CONTROL_LABEL_CLASS}>
              {t(PRIORITY_LABEL_KEYS[level])}
            </span>
          </div>
        ))}
      </div>
    </MapControlCard>
  );
};
