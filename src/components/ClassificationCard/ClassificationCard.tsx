import type { AnalysisRankingGroup } from "@/utils/analysis";
import { useState } from "react";
import { Chevron } from "../Chevron/Chevron";
import { useMapLayer } from "@/components/MapLayerContext/MapLayerContext";
import { Icon } from "../Icon/Icon";

interface ClassificationCardProps {
  group: AnalysisRankingGroup;
  onItemSelect?: (locationKey: string) => void;
}

export function ClassificationCard({ group, onItemSelect }: ClassificationCardProps) {
  const { setSelectedState } = useMapLayer();
  const [isOpen, setIsOpen] = useState(false);

  const bgColor = group.color ? `${group.color}22` : "#F0F0D7";
  const badgeColor =  "#2D3215";

  return (
    <div className="w-full max-w-[344px] rounded-lg border border-[#EFEFEF] overflow-hidden bg-white">
      <div
        className="flex flex-row items-center justify-between h-[56px] pl-3"
        style={{ backgroundColor: bgColor }}
      >
        <span className="text-[16px] font-semibold text-[#292829]">
          {group.label}
        </span>

        <div
          className="flex flex-row items-center justify-center gap-2 shrink-0 w-24 h-full px-2 py-4"
          style={{ backgroundColor: badgeColor }}
        >
          <span className="text-[24px] font-semibold leading-none tracking-tight text-white">
            {group.total}
          </span>
          <span className="text-[12px] font-semibold leading-6 text-white">
            {group.totalLabel}
          </span>
        </div>
      </div>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="flex flex-col gap-2 p-2">
          {group.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onItemSelect?.(item.id);
                setSelectedState(item.id);
              }}
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-[#E4E5E2] hover:bg-[#D6D7D3] transition-colors"
            >
              <span className="text-[14px] text-[#292829]">{item.label}</span>
              {item.trailingLabel ? (
                <span className="text-[12px] text-neutral-500">{item.trailingLabel}</span>
              ) : (
                <Icon id="chevron-down" size={16} className="-rotate-90 text-[#292829]" />
              )}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full h-[28px] flex items-center justify-center gap-2 bg-[#C8CAC5]"
      >
        <span className="text-[12px] font-medium text-[#292829]">
          Lista de estados
        </span>
        <Chevron open={isOpen} from="down" to="up" size={16} />
      </button>
    </div>
  );
}