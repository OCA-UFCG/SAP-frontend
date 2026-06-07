"use client";

import { useEffect, useMemo, useState } from "react";
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

interface MunicipalAnalysisApiResponse {
  imageData?: PanelLayerI["imageData"] | null;
}

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
  const [analysisImageDataByLayerId, setAnalysisImageDataByLayerId] = useState<
    Record<string, PanelLayerI["imageData"] | null>
  >({});

  useEffect(() => {
    if (!dataset?.id || analysisImageDataByLayerId[dataset.id] !== undefined) {
      return;
    }

    const controller = new AbortController();

    fetch(`/api/municipal-analysis/${encodeURIComponent(dataset.id)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Municipal analysis request failed with status ${response.status}`,
          );
        }

        return (await response.json()) as MunicipalAnalysisApiResponse;
      })
      .then((data) => {
        setAnalysisImageDataByLayerId((current) => ({
          ...current,
          [dataset.id]: data.imageData ?? null,
        }));
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        console.warn("Falha ao carregar municipalAnalysis sob demanda.", error);
        setAnalysisImageDataByLayerId((current) => ({
          ...current,
          [dataset.id]: null,
        }));
      })
    return () => {
      controller.abort();
    };
  }, [analysisImageDataByLayerId, dataset?.id]);

  const enrichedDataset = useMemo(() => {
    if (!dataset?.id) {
      return dataset;
    }

    const imageData = analysisImageDataByLayerId[dataset.id];

    if (!imageData) {
      return dataset;
    }

    return {
      ...dataset,
      imageData,
    };
  }, [analysisImageDataByLayerId, dataset]);

  const yearOptions = useMemo(
    () => getAnalysisYearOptions(enrichedDataset),
    [enrichedDataset],
  );

  function handleGoBack() {
    resetPlatformState();
    onRequestSectionChange?.("monitoring");
  }

  const effectiveYear = useMemo(
    () => getEffectiveAnalysisYear(enrichedDataset, activeYear),
    [enrichedDataset, activeYear],
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
        enrichedDataset,
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
        enrichedDataset,
        effectiveYear,
        selectedLocationKey,
      ),
    [enrichedDataset, effectiveYear, selectedLocationKey],
  );

  const unavailableLocationName = useMemo(
    () =>
      getAnalysisLocationName(enrichedDataset, effectiveYear, selectedLocationKey) ??
      getFallbackAnalysisLocationName(selectedLocationKey),
    [enrichedDataset, effectiveYear, selectedLocationKey],
  );

  useEffect(() => {
    if (!enrichedDataset?.imageData || !effectiveYear) {
      setActiveLegend(null);
      return;
    }
    setActiveLegend(getAnalysisLegend(enrichedDataset, effectiveYear));
  }, [enrichedDataset, effectiveYear, setActiveLegend]);

  // Extract years and classes only when imageData is CompactTerritorialAnalysisDataset
  const temporalYears =
    enrichedDataset?.imageData && "years" in enrichedDataset.imageData
      ? (enrichedDataset.imageData as CompactTerritorialAnalysisDataset).years
      : undefined;

  const temporalClasses =
    enrichedDataset?.imageData && "classes" in enrichedDataset.imageData
      ? (enrichedDataset.imageData as CompactTerritorialAnalysisDataset).classes
      : undefined;
  const isMunicipalAnalysisLoading = Boolean(
    dataset?.id && analysisImageDataByLayerId[dataset.id] === undefined,
  );

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
      emptyStateTitle={
        `Análise indisponível para ${unavailableLocationName}`
      }
      emptyStateDescription={
        isMunicipalAnalysisLoading
          ? "Os dados municipais desta camada estão sendo carregados sob demanda."
          : `Os dados de análise para ${unavailableLocationName} ainda não estão disponíveis neste módulo.`
      }
    />
  );
}
