"use client";

import { useTranslations } from "next-intl";
import type { BasemapId } from "@/components/Map/Map";
import { MAP_CONTROL_LABEL_CLASS, MapControlCard } from "./MapControlCard";

interface BasemapControlProps {
  basemap: BasemapId;
  onChange: (basemap: BasemapId) => void;
}

export function BasemapControl({ basemap, onChange }: BasemapControlProps) {
  const t = useTranslations("PlatformMap");

  const optionClassName = (option: BasemapId) =>
    `flex min-w-0 flex-1 items-center justify-center rounded-[4px] px-2 font-open-sans text-[10px] font-medium leading-[18px] transition-colors ${
      basemap === option
        ? "bg-[#989F43] text-white shadow-sm"
        : "text-[#292829] hover:bg-[#E4E5E2]"
    }`;

  return (
    <MapControlCard ariaLabel={t("basemap")}>
      <div className="flex items-center gap-2">
        <span className={`${MAP_CONTROL_LABEL_CLASS} w-[66px] shrink-0`}>
          {t("basemap")}
        </span>
        <div className="flex h-7 min-w-0 flex-1 rounded-md bg-[#F1F5F9] p-0.5">
          <button
            type="button"
            onClick={() => onChange("osm")}
            aria-pressed={basemap === "osm"}
            className={optionClassName("osm")}
          >
            {t("street")}
          </button>
          <button
            type="button"
            onClick={() => onChange("satellite")}
            aria-pressed={basemap === "satellite"}
            className={optionClassName("satellite")}
          >
            {t("satellite")}
          </button>
        </div>
      </div>
    </MapControlCard>
  );
}
