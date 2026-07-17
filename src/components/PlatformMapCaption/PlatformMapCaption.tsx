"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Chevron } from "../Chevron/Chevron";
import { IImageParam } from "@/utils/interfaces";

/**
 * PlatformMapCaption
 *
 * Placeholder for the map legend/caption overlay (bottom-right).
 *
 * This is intentionally minimal for now; the goal is to make the planned
 * component hierarchy explicit.
 */
export function PlatformMapCaption({ legend }: { legend: IImageParam[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations("PlatformMapCaption");
  const shouldScroll = legend.length > 6;

  return (
    <div className="w-[302px] overflow-hidden rounded-lg border border-[#EFEFEF] bg-white">
      <div className="box-border flex h-10 w-full flex-col items-start justify-center gap-1.5 border-b border-[#E5E5E5] bg-[#F8F7F8] px-3 py-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex h-6 w-full cursor-pointer items-center gap-1.5 bg-transparent text-left"
          aria-expanded={isOpen}
        >
          <h2 className="h-5 min-w-0 flex-1 font-inter text-xs font-medium leading-5 tracking-[-0.03em] text-[#292829]">
            {t("title")}
          </h2>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center text-black">
            <Chevron open={isOpen} from="down" to="up" size={24} />
          </span>
        </button>
      </div>
      <div>
        <div
          className={`
            overflow-hidden rounded-b-xl
            transition-all duration-400 ease-in-out
            ${isOpen ? "max-h-96 opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-0"}
          `}
        >
          <div className="bg-white border-neutral-200 px-4 py-4">
            <div
              className={`flex flex-col gap-3 ${shouldScroll ? "max-h-[168px] overflow-y-auto pr-2" : ""}`}
            >
              {legend.map((item) => {
                const slug = item.label
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .replace(/</g, "menor-que")
                  .replace(/>/g, "maior-que")
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/(^-|-$)+/g, "");
                
                const displayLabel = t.has(`labels.${slug}`) 
                  ? t(`labels.${slug}`) 
                  : item.label;

                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <span
                      className="h-4 w-4 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-black leading-none text-[#333333]">
                      {displayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
