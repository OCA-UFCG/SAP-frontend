"use client";

import { useTranslations } from "next-intl";
import type { BasemapId } from "@/components/Map/Map";

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
    <div
      className="box-border flex h-[50px] w-[302px] shrink-0 items-center gap-2 self-stretch rounded-lg border border-[#EFEFEF] bg-white p-4"
      role="group"
      aria-label={t("basemap")}
    >
      <span className="h-[18px] w-[66px] shrink-0 font-open-sans text-[10px] font-normal leading-[18px] tracking-[-0.006em] text-[#292829]">
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
  );
}
