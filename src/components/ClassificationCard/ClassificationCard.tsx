import {
  ClassificationKey,
  classificationMeta,
  rankingMeta,
} from "@/utils/constants";
import droughtData from "../../../public/dados-seca.json";
import { useState } from "react";
import { Chevron } from "../Chevron/Chevron";
import { useMapLayer } from "@/components/MapLayerContext/MapLayerContext";
import { Icon } from "../Icon/Icon";

interface ClassificationCardProps {
  classificationKey: ClassificationKey;
  data?: Record<string, State>;
  mode?: "estados" | "cidades";
}

export type State = {
  nome: string;
  status: Record<ClassificationKey, number>;
};

function getTopItemsByClassification(
  data: Record<string, State>,
  classificationKey: ClassificationKey,
  limit = 10,
) {
  return Object.entries(data)
    .filter(([key]) => key !== "br")
    .map(([key, item]) => ({
      key,
      name: item.nome,
      sortKey: item.status[classificationKey] ?? 0,
    }))
    .sort((a, b) => b.sortKey - a.sortKey)
    .filter((s) => s.sortKey > 0)
    .slice(0, limit);
}

export function ClassificationCard({
  classificationKey,
  data,
  mode = "estados",
}: ClassificationCardProps) {
  const { setSelectedState } = useMapLayer();
  const [isOpen, setIsOpen] = useState(false);
  const meta = rankingMeta[classificationKey];

  const resolvedData = (data ?? droughtData) as Record<string, State>;
  const topItems = getTopItemsByClassification(resolvedData, classificationKey);

  const label = mode === "cidades" ? "Cidades" : "Estados";

  return (
    <div className="w-full max-w-[344px] rounded-lg border border-[#EFEFEF] overflow-hidden bg-white">
      <div
        className="flex flex-row items-center justify-between h-[56px] pl-3"
        style={{ backgroundColor: meta.bg }}
      >
        <span className="text-[16px] font-semibold" style={{ color: meta.text }}>
          {classificationMeta[classificationKey].label}
        </span>

        <div
          className="flex flex-row items-center justify-center gap-2 shrink-0 w-24 h-full px-2 py-4"
          style={{ backgroundColor: meta.badgeBg }}
        >
          <span
            className="text-[24px] font-semibold leading-none tracking-tight"
            style={{ color: meta.badgeText }}
          >
            {topItems.length}
          </span>
          <span
            className="text-[12px] font-semibold leading-6"
            style={{ color: meta.badgeText }}
          >
            {label}
          </span>
        </div>
      </div>

      <div
        className={`
          overflow-hidden transition-all duration-300 ease-in-out
          ${isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}
        `}
      >
        <div className="flex flex-col gap-2 p-2">
          {topItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setSelectedState(item.key)}
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-[#E4E5E2] hover:bg-[#D6D7D3] transition-colors"
            >
              <span className="text-[14px] text-[#292829]">{item.name}</span>
              <Icon id="chevron-down" size={16} className="-rotate-90 text-[#292829]" />
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
          Lista de {label.toLowerCase()}
        </span>
        <Chevron open={isOpen} from="down" to="up" size={16} />
      </button>
    </div>
  );
}