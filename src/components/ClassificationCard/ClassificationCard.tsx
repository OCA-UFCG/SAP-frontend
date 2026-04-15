import { ClassificationKey, TIER_CONFIG } from "@/utils/constants";
import droughtData from "../../../public/dados-seca.json";
import { useState } from "react";
import { Chevron } from "../Chevron/Chevron";
import { useMapLayer } from "@/components/MapLayerContext/MapLayerContext";
import { Icon } from "../Icon/Icon";

interface ClassificationCardProps {
    classificationKey: ClassificationKey;
}

type State = {
    nome: string;
    status: Record<ClassificationKey, number>;
}

const data = droughtData as Record<string, State>;

function getTopStatesByClassification(classificationKey: ClassificationKey, limit = 10) {
  return Object.entries(data)
    .filter(([key]) => key !== "br")
    .map(([key, data]) => ({
      key,
      name: data.nome,
      sortKey: data.status[classificationKey] ?? 0,
    }))
    .sort((a, b) => b.sortKey - a.sortKey)
    .filter((s) => s.sortKey > 0)
    .slice(0, limit);
}

export function ClassificationCard({ classificationKey }: ClassificationCardProps) {
    const { setSelectedState } = useMapLayer();
    const [isOpen, setIsOpen] = useState(false);
    const config = TIER_CONFIG[classificationKey];
    const topStates = getTopStatesByClassification(classificationKey);

    return (
        <div className="w-full max-w-[344px] rounded-lg border border-[#EFEFEF] overflow-hidden bg-white">
            
            <div
            className="w-full flex items-center justify-between h-[56px] pl-3"
            style={{ backgroundColor: config.color }}
            >
            <span className="text-[16px] font-semibold text-[#21240F]">
                {config.label}
            </span>

            <div className="flex items-center justify-center gap-1 w-[96px] h-full bg-[#21240F] ">
                <span className="text-[24px] font-semibold text-[#F8F7F8] leading-none">
                {topStates.length}
                </span>
                <span className="text-[12px] font-semibold text-[#F8F7F8]">
                Estados
                </span>
            </div>
            </div>

            {isOpen && (
            <div className="flex flex-col gap-2 p-2">
                {topStates.map((state) => (
                <button
                key={state.key}
                onClick={() => setSelectedState(state.key)}
                className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-[#E4E5E2] hover:bg-[#D6D7D3] transition-colors"
                >
                <span className="text-[14px] text-[#292829]">
                    {state.name}
                </span>

                <Icon
                    id="chevron-down"
                    size={16}
                    className="-rotate-90 text-[#292829]"
                />
                </button>
                ))}
            </div>
            )}

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