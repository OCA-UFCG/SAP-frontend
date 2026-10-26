"use client";

import clsx from "clsx";
import { useId } from "react";
import { useTranslations } from "next-intl";
import type { PanelLayerI } from "@/utils/interfaces";
import type { SourceGroupMember } from "@/utils/sourceGroup";

interface SourceGroupFilterProps {
  members: readonly SourceGroupMember<PanelLayerI>[];
  currentLayerId: string;
  onSelect: (layer: PanelLayerI) => void;
}

/**
 * A "Fonte dos dados" de um índice que existe com mais de uma base, como o
 * Índice de Aridez (BR-DWGD e ERA5 Land): cada fonte é uma camada, e escolher
 * outra troca a camada do mapa. Tem a mesma cara dos filtros da previsão.
 */
export function SourceGroupFilter({
  members,
  currentLayerId,
  onSelect,
}: SourceGroupFilterProps) {
  const t = useTranslations("AnalysisPanel.sourceGroupFilter");
  const labelId = useId();

  return (
    <div className="flex w-full max-w-[392px] flex-col items-start gap-[6px]">
      <span
        id={labelId}
        className="text-[14px] font-medium leading-[20px] text-[#292829]"
      >
        {t("label")}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex h-10 w-full gap-1 rounded-lg bg-[#E4E5E2] p-1 shadow-sm"
      >
        {members.map(({ item, source }) => {
          const selected = item.id === currentLayerId;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={selected}
              title={source}
              onClick={() => {
                if (!selected) onSelect(item);
              }}
              className={clsx(
                "min-w-0 flex-1 truncate rounded-md px-2 text-sm transition-colors duration-150",
                "focus-visible:ring-2 focus-visible:ring-[#989F43] focus-visible:outline-none",
                selected
                  ? "bg-[#989F43] font-medium text-white"
                  : "cursor-pointer text-[#292829] hover:bg-[#F0F0D7]",
              )}
            >
              {source}
            </button>
          );
        })}
      </div>
    </div>
  );
}
