"use client";

import { useState } from "react";
import { useMapLayer } from "@/components/MapLayerContext/MapLayerContext";
import { CDIVectorData } from "@/components/PlatformMap/PlatformMap";
import { DroughtDataset } from "../DroughtDataset/DroughtDataset";
import type { IDroughtDataset } from "../DroughtDataset/DroughtDataset";
import { PlatformSection } from "../PlatformSideRail/PlatformSideRail";
import { Chevron } from "../Chevron/Chevron";
import { PanelLayerI, IEEInfo } from "@/utils/interfaces";
import cdiData from "../../data/CDI_Janeiro_2024_Vetores.json";

interface AccordionItemData {
  id: number;
  label: string;
  datasets?: IDroughtDataset[];
}

export interface AccordionContextProps {
  activeSection: PlatformSection;
  panelLayers?: PanelLayerI[];
  onRequestSectionChange?: (next: PlatformSection) => void;
}

const CATEGORY_ORDER = ["Seca", "Desertificação"];

const DATASET_REGISTRY: Record<string, CDIVectorData> = {
  CDI: cdiData as unknown as CDIVectorData,
};

function buildMonitoringItems(panelLayers: PanelLayerI[]): AccordionItemData[] {
  const grouped = panelLayers.reduce<Record<string, IDroughtDataset[]>>(
    (acc, layer, index) => {
      const dataset: IDroughtDataset = {
        id: index + 1,
        title: layer.id,
        description: layer.description,
        image: layer.previewMap?.url,
        fileRef: layer.id,
      };

      if (!acc[layer.category]) acc[layer.category] = [];
      acc[layer.category].push(dataset);
      return acc;
    },
    {},
  );

  return CATEGORY_ORDER.map((label, index) => ({
    id: index + 1,
    label,
    datasets: grouped[label] ?? [],
  }));
}

function ContextHeader() {
  return (
    <header className="px-4 pt-10 pb-4">
      <h2 className="text-[22px] font-semibold text-neutral-800">
        O que você deseja monitorar?
      </h2>
      <p className="mt-2 text-sm text-neutral-600">
        Selecione que módulo você deseja analisar
      </p>
    </header>
  );
}

function AccordionItem({
  item,
  open,
  onToggle,
  onAnalyze,
}: {
  item: AccordionItemData;
  open: boolean;
  onToggle: () => void;
  onAnalyze?: (dataset: IDroughtDataset) => void;
}) {
  const hasDatasets = Boolean(item.datasets?.length);
  const isOpen = open && hasDatasets;

  return (
    <div
      className={`
        box-border flex flex-col items-start w-full
        bg-white hover:bg-[#E4E5E2]
        border border-[#EFEFEF] rounded-lg transition-colors duration-150
        ${isOpen ? "px-4 pt-1 pb-4 gap-4" : "px-4 py-1 gap-0"}
      `}
    >
      <button
        type="button"
        onClick={onToggle}
        className="cursor-pointer flex flex-row items-center w-full py-4 gap-[18px] text-left bg-transparent"
        style={{ height: 56 }}
        aria-expanded={isOpen}
      >
        <span
          className="flex-1 text-base font-medium text-[#0F172A]"
          style={{ fontFamily: "Inter", fontStyle: "normal" }}
        >
          {item.label}
        </span>

        <Chevron open={isOpen} from="down" to="up" />
      </button>

      <div
        className="grid w-full overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 flex flex-col gap-4">
          {hasDatasets && (
            <>
              <hr className="w-full border-t border-[#EFEFEF]" />
              {item.datasets!.map((dataset) => (
                <DroughtDataset key={dataset.id} card={dataset} onAnalyze={onAnalyze} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function AccordionContext({
  panelLayers = [],
  onRequestSectionChange,
}: AccordionContextProps) {
  const [openId, setOpenId] = useState<number | null>(null);
  const { activeData, setActiveData, activeEEData, setActiveEEData } = useMapLayer();

  const monitoringItems = buildMonitoringItems(panelLayers);

  function handleToggle(id: number) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  function handleAnalyze(dataset: IDroughtDataset) {
    if (!dataset.fileRef) return;

    // Find Contentful Layer
    const panelLayer = panelLayers.find(layer => layer.id === dataset.fileRef);
    const hasEEData = panelLayer && panelLayer.imageData;

    // Check if it's a vector layer in the registry
    const vectorData = DATASET_REGISTRY[dataset.fileRef];
    
    if (!vectorData && !hasEEData) return;

    if (vectorData) {
      setActiveData(activeData === vectorData ? null : vectorData);
      setActiveEEData(null);
    } else if (hasEEData) {
      const eeConfig = panelLayer as unknown as IEEInfo;
      // Compare by id to trigger correctly when same config reference but different object
      const isActive = activeEEData?.id === eeConfig.id;
      setActiveEEData(isActive ? null : eeConfig);
      setActiveData(null);
    }

    onRequestSectionChange?.("analysis");
  }

  return (
    <div className="h-full flex flex-col bg-[#F6F7F6]">
      <ContextHeader />
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <div className="flex flex-col gap-6">
          {monitoringItems.map((item) => (
            <AccordionItem
              key={item.id}
              item={item}
              open={openId === item.id}
              onToggle={() => handleToggle(item.id)}
              onAnalyze={handleAnalyze}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
