"use client";

import { useMemo } from "react";
import { useMapLayer } from "@/components/MapLayerContext/MapLayerContext";
import type { CDIVectorData } from "@/components/PlatformMap/PlatformMap";
import { DroughtDataset } from "@/components/DroughtDataset/DroughtDataset";
import type { IDroughtDataset } from "@/components/DroughtDataset/DroughtDataset";
import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";
import type { IEEInfo, PanelLayerI } from "@/utils/interfaces";
import cdiData from "../../data/CDI_Janeiro_2024_Vetores.json";

export interface ModulesContextProps {
  activeSection: PlatformSection;
  panelLayers?: PanelLayerI[];
  onRequestSectionChange?: (next: PlatformSection) => void;
}

type LayerDataset = IDroughtDataset & {
  layer: PanelLayerI;
};

const DATASET_REGISTRY: Record<string, CDIVectorData> = {
  CDI: cdiData as unknown as CDIVectorData,
};

function buildLayerDatasets(panelLayers: PanelLayerI[]): LayerDataset[] {
  return panelLayers.map((layer, index) => ({
    id: index + 1,
    title: layer.name,
    description: layer.description,
    image: layer.previewMap?.url,
    fileRef: layer.id,
    layer,
  }));
}

function ContextHeader() {
  return (
    <header className="flex flex-col gap-2">
      <h2 className="font-['Inter'] font-semibold text-[24px] leading-[24px] tracking-[-0.015em] text-[#292829]">
        O que você deseja monitorar?
      </h2>
      <p className="font-['Inter'] font-medium text-[16px] leading-[24px] tracking-[-0.015em] text-[#292829]">
        Selecione que monitor você deseja analisar
      </p>
    </header>
  );
}

export function ModulesContext({
  panelLayers = [],
  onRequestSectionChange,
}: ModulesContextProps) {
  const {
    activeData,
    setActiveData,
    activeEEData,
    activeLegend,
    setActiveEEData,
    setActiveLayerId,
    setActiveLegend
  } = useMapLayer();

  const datasets = useMemo(
    () => buildLayerDatasets(panelLayers),
    [panelLayers],
  );

  const getCaption = (layer: PanelLayerI) => {
      const entries = Object.entries(layer.imageData || {});
      const defaultEntry = entries.find(([, val]) => val.default) ?? entries[0];
      return defaultEntry?.[1]?.imageParams ?? null;
    };

  function handleToggle(dataset: LayerDataset) {
    if (!dataset.fileRef) return;

    const vectorData = DATASET_REGISTRY[dataset.fileRef];
    const hasEEData = Boolean(dataset.layer.imageData);

    if (!vectorData && !hasEEData) return;

    if (vectorData) {
      const isActive = activeData === vectorData;
      setActiveData(isActive ? null : vectorData);
      setActiveEEData(null);
      setActiveLayerId(isActive ? null : dataset.fileRef);

      if (isActive) {
        setActiveLegend(null); 
      } else {
        setActiveLegend(getCaption(dataset.layer));
      }
      
      return;
    }

    if (hasEEData) {
      const eeConfig = dataset.layer as unknown as IEEInfo;
      const isActive = activeEEData?.id === eeConfig.id;
      setActiveEEData(isActive ? null : eeConfig);
      setActiveData(null);
      setActiveLayerId(isActive ? null : eeConfig.id);

      if (isActive) {
        setActiveLegend(null); 
      } else {
        setActiveLegend(getCaption(dataset.layer));
      }
    }
  }

  function handleDetails(dataset: LayerDataset) {
    if (!dataset.fileRef) return;

    const vectorData = DATASET_REGISTRY[dataset.fileRef];
    const hasEEData = Boolean(dataset.layer.imageData);

    if (!vectorData && !hasEEData) return;

    // Ensure the chosen layer is active before opening the detailing view.
    if (vectorData) {
      setActiveData(vectorData);
      setActiveEEData(null);
      setActiveLayerId(dataset.fileRef);
    } else if (hasEEData) {
      const eeConfig = dataset.layer as unknown as IEEInfo;
      setActiveEEData(eeConfig);
      setActiveData(null);
      setActiveLayerId(eeConfig.id);
    }

    onRequestSectionChange?.("analysis");
  }

  return (
    <div className="h-full overflow-y-auto bg-[#F6F7F6] px-4 pt-12 pb-6">
      <div className="flex flex-col gap-6">
        <ContextHeader />

        <div className="flex flex-col gap-6">
          {datasets.map((dataset) => {
            const fileRef = dataset.fileRef ?? "";
            const vectorData = fileRef ? DATASET_REGISTRY[fileRef] : undefined;
            const hasEEData = Boolean(dataset.layer.imageData);
            const canApply = Boolean(vectorData) || hasEEData;

            const isActive = vectorData
              ? activeData === vectorData
              : hasEEData
                ? activeEEData?.id === fileRef
                : false;

            return (
              <DroughtDataset
                key={fileRef || dataset.id}
                card={dataset}
                active={isActive}
                disabled={!canApply}
                onToggle={() => handleToggle(dataset)}
                onDetails={() => handleDetails(dataset)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
