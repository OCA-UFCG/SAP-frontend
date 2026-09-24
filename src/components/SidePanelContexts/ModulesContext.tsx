"use client";

import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  useMapLayerActions,
  useMapLayerActiveState,
  useMapLayerViewState,
} from "@/components/MapLayerContext/MapLayerContext";
import { SpatialScopeSelect } from "@/components/SpatialScopeSelect/SpatialScopeSelect";
import { DroughtDataset } from "@/components/DroughtDataset/DroughtDataset";
import type { IDroughtDataset } from "@/components/DroughtDataset/DroughtDataset";
import { LayerAccordion } from "@/components/LayerAccordion/LayerAccordion";
import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";
import type { CDIVectorData } from "@/lib/geo";
import { trackUiEvent } from "@/services/telemetry/client";
import type { IEEInfo, PanelLayerI } from "@/utils/interfaces";
import type { SpatialSelection } from "@/utils/spatialScope";
import { getImageDataLegend } from "@/utils/imageData";
import {
  splitIntoLayerSubgroups,
  type SubgroupedItems,
} from "@/utils/layerSubgroups";
import { useMonitoringListState } from "./monitoringListState";
import cdiData from "../../data/CDI_Janeiro_2024_Vetores.json";

export interface ModulesContextProps {
  activeSection: PlatformSection;
  panelLayers?: PanelLayerI[];
  onRequestSectionChange?: (next: PlatformSection) => void;
  detailLayerId?: string;
}

type LayerDataset = IDroughtDataset & { category?: string };

interface DatasetGroup {
  key: string;
  title: string;
  datasets: LayerDataset[];
}

type SubgroupedDatasetGroup = DatasetGroup & SubgroupedItems<LayerDataset>;

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
    category: layer.category,
    imageData: layer.imageData,
    timeScale: layer.timeScale,
  }));
}

const CATEGORY_ORDER = [
  "Dados Climáticos",
  "Dados Ambientais",
  "Dados Socioeconômicos",
];

const CATEGORY_ORDER_INDEX = new Map(
  CATEGORY_ORDER.map((category, index) => [
    category.toLocaleLowerCase("pt-BR"),
    index,
  ]),
);

function normalizeCategory(category?: string): string {
  return category?.trim() || "Outros";
}

function compareCategoryTitles(left: string, right: string): number {
  const leftIndex = CATEGORY_ORDER_INDEX.get(left.toLocaleLowerCase("pt-BR"));
  const rightIndex = CATEGORY_ORDER_INDEX.get(right.toLocaleLowerCase("pt-BR"));

  if (leftIndex != null && rightIndex != null) {
    return leftIndex - rightIndex;
  }

  if (leftIndex != null) {
    return -1;
  }

  if (rightIndex != null) {
    return 1;
  }

  return left.localeCompare(right, "pt-BR");
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
      imageData={dataset.imageData}
      active={active}
      disabled={disabled}
      onToggle={handleToggle}
      onDetails={handleDetails}
    />
  );
});

function ContextHeader() {
  const t = useTranslations("ModulesContext");
  return (
    <header className="flex flex-col gap-2">
      <h2 className="font-inter font-semibold text-[24px] leading-[24px] tracking-[-0.015em] text-[#292829]">
        {t("title")}
      </h2>
      <p className="font-inter font-medium text-[16px] leading-[24px] tracking-[-0.015em] text-[#292829]">
        {t("subtitle")}
      </p>
    </header>
  );
}

export function ModulesContext({
  activeSection,
  panelLayers = [],
  onRequestSectionChange,
  detailLayerId,
}: ModulesContextProps) {
  const t = useTranslations("ModulesContext");
  const { activeData, activeEEData } = useMapLayerActiveState();
  const {
    activateVectorLayer,
    activateEeLayer,
    clearActiveLayer,
    setSpatialSelection,
    setSelectedState,
    setSelectedMunicipalityCode,
  } = useMapLayerActions();
  const { spatialSelection } = useMapLayerViewState();
  const listState = useMonitoringListState();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Abrir um índice desmonta esta listagem; ao voltar, devolvemos a rolagem que
  // o usuário tinha deixado em vez de reabrir a lista no topo. As miniaturas das
  // camadas chegam depois da primeira pintura, então na montagem o painel ainda
  // é curto demais para a posição salva e o navegador a limita ao fim atual — daí
  // reaplicarmos enquanto o conteúdo cresce, até alcançar o alvo.
  const restoreScrollTop = listState?.getScrollTop;
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !restoreScrollTop) return;

    const target = restoreScrollTop();
    if (target <= 0) return;

    const applyTarget = () => {
      container.scrollTop = target;
      return container.scrollTop >= target;
    };

    if (applyTarget()) return;

    const observer = new ResizeObserver(() => {
      if (applyTarget()) {
        observer.disconnect();
      }
    });

    observer.observe(container);
    Array.from(container.children).forEach((child) => observer.observe(child));

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || !listState) return;

    listState.setScrollTop(container.scrollTop);
  }, [listState]);

  const datasets = useMemo(
    () => buildLayerDatasets(panelLayers),
    [panelLayers],
  );

  const groupedDatasets = useMemo<SubgroupedDatasetGroup[]>(() => {
    const groups = new Map<string, DatasetGroup>();

    datasets.forEach((dataset) => {
      const title = normalizeCategory(dataset.category);
      const key = title.toLocaleLowerCase("pt-BR");
      const existingGroup = groups.get(key);

      if (existingGroup) {
        existingGroup.datasets.push(dataset);
        return;
      }

      groups.set(key, {
        key,
        title,
        datasets: [dataset],
      });
    });

    return Array.from(groups.values())
      .sort((left, right) => compareCategoryTitles(left.title, right.title))
      .map((group) => ({
        ...group,
        ...splitIntoLayerSubgroups(
          group.title,
          group.datasets,
          (dataset) => dataset.title,
        ),
      }));
  }, [datasets]);

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
          trackUiEvent({
            eventName: "layer_toggled",
            surface: "analysis-panel",
            activeLayerId: layer.id,
            activeLayerName: layer.name,
            layerKind: "vector",
            action: "deactivated",
            activeSection,
          });
        } else {
          activateVectorLayer(layerId, vectorData, getCaption(layer));
          trackUiEvent({
            eventName: "layer_toggled",
            surface: "analysis-panel",
            activeLayerId: layer.id,
            activeLayerName: layer.name,
            layerKind: "vector",
            action: "activated",
            activeSection,
          });
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

        trackUiEvent({
          eventName: "layer_toggled",
          surface: "analysis-panel",
          activeLayerId: layer.id,
          activeLayerName: layer.name,
          layerKind: "ee",
          action: isActive ? "deactivated" : "activated",
          activeSection,
        });
      }
    },
    [
      activeSection,
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

      trackUiEvent({
        eventName: "layer_details_opened",
        surface: "analysis-panel",
        activeLayerId: layer.id,
        activeLayerName: layer.name,
        layerKind: vectorData ? "vector" : "ee",
        activeSection,
      });

      onRequestSectionChange?.("analysis-detail");
    },
    [
      activeSection,
      activateEeLayer,
      activateVectorLayer,
      getCaption,
      layerById,
      onRequestSectionChange,
    ],
  );

  const openedDetailLayerRef = useRef<string | null>(null);
  useEffect(() => {
    if (!detailLayerId || openedDetailLayerRef.current === detailLayerId)
      return;
    if (!layerById.has(detailLayerId)) return;
    openedDetailLayerRef.current = detailLayerId;
    handleDetails(detailLayerId);
  }, [detailLayerId, handleDetails, layerById]);

  const handleSpatialSelectionChange = useCallback(
    (value: SpatialSelection) => {
      setSpatialSelection(value);
      setSelectedState("br");
      setSelectedMunicipalityCode(null);
    },
    [setSpatialSelection, setSelectedState, setSelectedMunicipalityCode],
  );

  const renderDatasetCard = (dataset: LayerDataset) => {
    const fileRef = dataset.fileRef ?? "";
    const vectorData = fileRef ? DATASET_REGISTRY[fileRef] : undefined;
    const hasEEData = Boolean(fileRef && layerById.get(fileRef)?.imageData);
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
  };

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto bg-[#F6F7F6] px-4 pt-12 pb-6"
    >
      <div className="flex flex-col gap-6">
        <ContextHeader />

        <div>
          <SpatialScopeSelect
            spatialSelection={spatialSelection}
            onSpatialSelectionChange={handleSpatialSelectionChange}
          />
        </div>

        <div className="flex flex-col gap-6">
          {groupedDatasets.map((group) => {
            const categoryKeyMap: Record<string, string> = {
              "dados climáticos": "climate",
              "dados ambientais": "environmental",
              "dados socioeconômicos": "socioeconomic",
              outros: "others",
            };

            return (
              <LayerAccordion
                key={group.key}
                open={listState?.isCategoryOpen(group.key)}
                onOpenChange={(open) =>
                  listState?.setCategoryOpen(group.key, open)
                }
                title={
                  categoryKeyMap[group.key]
                    ? t(`categories.${categoryKeyMap[group.key]}`)
                    : group.title
                }
              >
                {group.items.map(renderDatasetCard)}
                {group.subgroups.map((subgroup) => {
                  const subgroupKey = `${group.key}/${subgroup.key}`;
                  return (
                    <LayerAccordion
                      key={subgroupKey}
                      variant="subgroup"
                      open={listState?.isCategoryOpen(subgroupKey)}
                      onOpenChange={(open) =>
                        listState?.setCategoryOpen(subgroupKey, open)
                      }
                      title={t(`subgroups.${subgroup.key}`)}
                    >
                      {subgroup.items.map(renderDatasetCard)}
                    </LayerAccordion>
                  );
                })}
              </LayerAccordion>
            );
          })}
        </div>
      </div>
    </div>
  );
}
