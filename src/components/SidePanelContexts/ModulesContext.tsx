"use client";

import { memo, useCallback, useMemo } from "react";
import {
  useMapLayerActions,
  useMapLayerActiveState,
} from "@/components/MapLayerContext/MapLayerContext";
import { DroughtDataset } from "@/components/DroughtDataset/DroughtDataset";
import type { IDroughtDataset } from "@/components/DroughtDataset/DroughtDataset";
import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";
import type { CDIVectorData } from "@/lib/geo";
import type { IEEInfo, PanelLayerI } from "@/utils/interfaces";
import { getImageDataLegend } from "@/utils/imageData";
import cdiData from "../../data/CDI_Janeiro_2024_Vetores.json";

export interface ModulesContextProps {
  activeSection: PlatformSection;
  panelLayers?: PanelLayerI[];
  onRequestSectionChange?: (next: PlatformSection) => void;
}

type LayerDataset = IDroughtDataset;

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
  }));
}

interface LayerDatasetCardProps {
  dataset: LayerDataset;
  active: boolean;
  disabled: boolean;
  onToggleLayer: (layerId: string) => void;
  onOpenDetails: (layerId: string) => void;
}

const LayerDatasetCard = memo(function LayerDatasetCard({
  dataset,
  active,
  disabled,
  onToggleLayer,
  onOpenDetails,
}: LayerDatasetCardProps) {
  const fileRef = dataset.fileRef ?? "";

  const handleToggle = useCallback(() => {
    if (!fileRef) return;
    onToggleLayer(fileRef);
  }, [fileRef, onToggleLayer]);

  const handleDetails = useCallback(() => {
    if (!fileRef) return;
    onOpenDetails(fileRef);
  }, [fileRef, onOpenDetails]);

  return (
    <DroughtDataset
      card={dataset}
      active={active}
      disabled={disabled}
      onToggle={handleToggle}
      onDetails={handleDetails}
    />
  );
});

function ContextHeader() {
  return (
    <header className="flex flex-col gap-2">
      <h2 className="font-inter font-semibold text-[24px] leading-[24px] tracking-[-0.015em] text-[#292829]">
        O que você deseja monitorar?
      </h2>
      <p className="font-inter font-medium text-[16px] leading-[24px] tracking-[-0.015em] text-[#292829]">
        Selecione que monitor você deseja analisar
      </p>
    </header>
  );
}

export function ModulesContext({
  panelLayers = [],
  onRequestSectionChange,
}: ModulesContextProps) {
  const { activeData, activeEEData } = useMapLayerActiveState();
  const { activateVectorLayer, activateEeLayer, clearActiveLayer } =
    useMapLayerActions();

  const datasets = useMemo(
    () => buildLayerDatasets(panelLayers),
    [panelLayers],
  );

  const layerById = useMemo(() => {
    return new Map(panelLayers.map((layer) => [layer.id, layer]));
  }, [panelLayers]);

  const getCaption = useCallback((layer: PanelLayerI) => {
    return getImageDataLegend(layer.imageData);
  }, []);

  const handleToggle = useCallback(
    (layerId: string) => {
      const layer = layerById.get(layerId);
      if (!layer) return;

      const vectorData = DATASET_REGISTRY[layerId];
      const hasEEData = Boolean(layer.imageData);

      if (!vectorData && !hasEEData) return;

      if (vectorData) {
        const isActive = activeData === vectorData;
        if (isActive) {
          clearActiveLayer();
        } else {
          activateVectorLayer(layerId, vectorData, getCaption(layer));
        }

        return;
      }

      if (hasEEData) {
        const eeConfig = layer as unknown as IEEInfo;
        const isActive = activeEEData?.id === eeConfig.id;
        if (isActive) {
          clearActiveLayer();
        } else {
          activateEeLayer(eeConfig, getCaption(layer));
        }
      }
    },
    [
      activeData,
      activeEEData,
      activateEeLayer,
      activateVectorLayer,
      clearActiveLayer,
      getCaption,
      layerById,
    ],
  );

  const handleDetails = useCallback(
    (layerId: string) => {
      const layer = layerById.get(layerId);
      if (!layer) return;

      const vectorData = DATASET_REGISTRY[layerId];
      const hasEEData = Boolean(layer.imageData);

      if (!vectorData && !hasEEData) return;

      // Ensure the chosen layer is active before opening the detailing view.
      if (vectorData) {
        activateVectorLayer(layerId, vectorData, getCaption(layer));
      } else if (hasEEData) {
        const eeConfig = layer as unknown as IEEInfo;
        activateEeLayer(eeConfig, getCaption(layer));
      }

      onRequestSectionChange?.("analysis-detail");
    },
    [
      activateEeLayer,
      activateVectorLayer,
      getCaption,
      layerById,
      onRequestSectionChange,
    ],
  );

  return (
    <div className="h-full overflow-y-auto bg-[#F6F7F6] px-4 pt-12 pb-6">
      <div className="flex flex-col gap-6">
        <ContextHeader />

        <div className="flex flex-col gap-6">
          {datasets.map((dataset) => {
            const fileRef = dataset.fileRef ?? "";
            const vectorData = fileRef ? DATASET_REGISTRY[fileRef] : undefined;
            const hasEEData = Boolean(
              fileRef && layerById.get(fileRef)?.imageData,
            );
            const canApply = Boolean(vectorData) || hasEEData;

            const isActive = vectorData
              ? activeData === vectorData
              : hasEEData
                ? activeEEData?.id === fileRef
                : false;

            return (
              <LayerDatasetCard
                key={fileRef || dataset.id}
                dataset={dataset}
                active={isActive}
                disabled={!canApply}
                onToggleLayer={handleToggle}
                onOpenDetails={handleDetails}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
