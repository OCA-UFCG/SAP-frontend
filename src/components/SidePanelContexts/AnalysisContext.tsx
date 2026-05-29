"use client";

import { useEffect, useMemo } from "react";
import { AnalysisPanel } from "@/components/analysis/AnalysisPanel";
import type { SearchSubmissionMetadata } from "@/components/SearchBar/types";
import {
  buildEmbeddedTerritorialAnalysisViewModel,
  getFallbackAnalysisLocationName,
  getAnalysisLegend,
  getAnalysisLocationName,
  getAnalysisYearOptions,
  getEffectiveAnalysisYear,
} from "@/components/analysis/analysis.mappers";
import {
  useMapLayerActions,
  useMapLayerActiveState,
  useMapLayerViewState,
} from "@/components/MapLayerContext/MapLayerContext";
import { resolveStateKeyFromSearch } from "@/lib/geo";
import { trackUiEvent } from "@/services/telemetry/client";
import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";
import type { PanelLayerI, IEEInfo } from "@/utils/interfaces";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";
import { statesObj } from "@/utils/constants";

export interface AnalysisContextProps {
  activeSection: PlatformSection;
  panelLayers?: PanelLayerI[];
  eeConfigs?: IEEInfo[];
  onRequestSectionChange?: (next: PlatformSection) => void;
}

export function AnalysisContext({
  activeSection,
  onRequestSectionChange,
  panelLayers,
}: AnalysisContextProps) {
  const { activeLayerId } = useMapLayerActiveState();
  const {
    setSelectedState,
    setSelectedMunicipalityCode,
    setActiveLegend,
    setActiveYear,
    resetPlatformState,
  } = useMapLayerActions();
  const { selectedState, selectedMunicipalityCode, activeYear } =
    useMapLayerViewState();

  const dataset = useMemo(() => {
    return panelLayers?.find((p) => p.id === activeLayerId) ?? panelLayers?.[0];
  }, [panelLayers, activeLayerId]);

  const yearOptions = useMemo(() => getAnalysisYearOptions(dataset), [dataset]);

  function handleGoBack() {
    resetPlatformState();
    onRequestSectionChange?.("monitoring");
  }

  const effectiveYear = useMemo(
    () => getEffectiveAnalysisYear(dataset, activeYear),
    [dataset, activeYear],
  );

  const activeAnalysisYear =
    effectiveYear ?? yearOptions[0]?.value ?? "general";

  const activeDateLabel =
    yearOptions.find((option) => option.value === activeAnalysisYear)?.label ??
    activeAnalysisYear;

  const handleSearch = (value: string, metadata: SearchSubmissionMetadata) => {
    const result = resolveStateKeyFromSearch(value, statesObj);
    const nextMunicipalityCode =
      result.type === "city" ? result.city.code : null;
    const selectedLocationKey = nextMunicipalityCode ?? result.key;

    setSelectedState(result.key);

    if (nextMunicipalityCode) {
      setSelectedMunicipalityCode(nextMunicipalityCode);
    } else {
      setSelectedMunicipalityCode(null);
    }

    const baseSearchEvent = {
      surface: "analysis-panel" as const,
      query: value,
      selectionMethod: metadata.selectionMethod,
      visibleOptionCount: metadata.visibleOptionCount,
      resolvedLocationType: result.type,
      resolvedStateKey: result.key,
      resolvedMunicipalityCode: nextMunicipalityCode ?? undefined,
      activeLayerId: dataset?.id,
      activeLayerName: dataset?.name,
      activeDateLabel,
      activeSection,
    };

    const hasLayerData = Boolean(
      dataset &&
      effectiveYear &&
      buildEmbeddedTerritorialAnalysisViewModel(
        dataset,
        effectiveYear,
        selectedLocationKey,
      ),
    );

    if (hasLayerData) {
      trackUiEvent({
        eventName: "search_found",
        ...baseSearchEvent,
      });
      return;
    }

    trackUiEvent({
      eventName: "search_not_found",
      ...baseSearchEvent,
    });
  };

  const selectedLocationKey = selectedMunicipalityCode ?? selectedState;

  const embeddedModel = useMemo(
    () =>
      buildEmbeddedTerritorialAnalysisViewModel(
        dataset,
        effectiveYear,
        selectedLocationKey,
      ),
    [dataset, effectiveYear, selectedLocationKey],
  );

  const unavailableLocationName = useMemo(
    () =>
      getAnalysisLocationName(dataset, effectiveYear, selectedLocationKey) ??
      getFallbackAnalysisLocationName(selectedLocationKey),
    [dataset, effectiveYear, selectedLocationKey],
  );

  useEffect(() => {
    if (!dataset?.imageData || !effectiveYear) {
      setActiveLegend(null);
      return;
    }
    setActiveLegend(getAnalysisLegend(dataset, effectiveYear));
  }, [dataset, effectiveYear, setActiveLegend]);

  // Extract years and classes only when imageData is CompactTerritorialAnalysisDataset
  const temporalYears =
    dataset?.imageData && "years" in dataset.imageData
      ? (dataset.imageData as CompactTerritorialAnalysisDataset).years
      : undefined;

  const temporalClasses =
    dataset?.imageData && "classes" in dataset.imageData
      ? (dataset.imageData as CompactTerritorialAnalysisDataset).classes
      : undefined;

  return (
    <AnalysisPanel
      moduleName={dataset?.name}
      yearOptions={yearOptions}
      activeYear={activeAnalysisYear}
      onBack={handleGoBack}
      onSearch={handleSearch}
      searchTelemetryContext={{
        activeLayerId: dataset?.id ?? "unknown-layer",
        activeLayerName: dataset?.name ?? "Camada desconhecida",
        activeDateLabel,
      }}
      onYearChange={setActiveYear}
      onRankingItemSelect={setSelectedState}
      model={embeddedModel}
      years={temporalYears}
      classes={temporalClasses}
      selectedState={selectedLocationKey}
      emptyStateTitle={`Análise indisponível para ${unavailableLocationName}`}
      emptyStateDescription={`Os dados de análise para ${unavailableLocationName} ainda não estão disponíveis neste módulo.`}
    />
  );
}
