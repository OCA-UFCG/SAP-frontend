"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AnalysisPanel } from "@/components/analysis/AnalysisPanel";
import type { SearchSubmissionMetadata } from "@/components/SearchBar/types";
import {
  getSpatialScopeLocationKey,
  getSpatialScopeLocationName,
  type SpatialSelection,
} from "@/utils/spatialScope";
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
import municipalAvailabilityIndex from "@/data/municipalAvailabilityIndex.json";
import {
  hasMunicipalLayerPeriod,
  type MunicipalAvailabilityIndex,
} from "@/utils/municipalAvailability";
import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";
import type { PanelLayerI, IEEInfo } from "@/utils/interfaces";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";
import { statesObj } from "@/utils/constants";
import {
  mergeMultiplePartialMunicipalImageData,
  mergePartialMunicipalImageData,
} from "@/utils/municipalAnalysisMerge";

interface MunicipalAnalysisApiResponse {
  imageData?: PanelLayerI["imageData"] | null;
}

function getMunicipalAnalysisRequestKey(layerId: string, yearKey: string) {
  return `${layerId}::${yearKey}`;
}

function getMunicipalAnalysisRequestYear(
  requestKey: string,
): string | undefined {
  return requestKey.split("::").at(1);
}

function getMunicipalSeriesRequestKey(
  layerId: string,
  datasetVersion: string,
  municipalityCode: string,
) {
  return `${layerId}::${datasetVersion}::${municipalityCode}`;
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
  const t = useTranslations("AnalysisContext");
  const tCaption = useTranslations("PlatformMapCaption");
  const { activeLayerId } = useMapLayerActiveState();
  const {
    setSelectedState,
    setSelectedMunicipalityCode,
    setActiveLegend,
    setActiveYear,
    setSpatialSelection,
    resetPlatformState,
  } = useMapLayerActions();
  const {
    selectedState,
    selectedMunicipalityCode,
    activeYear,
    spatialSelection,
  } = useMapLayerViewState();

  const dataset = useMemo(() => {
    return panelLayers?.find((p) => p.id === activeLayerId) ?? panelLayers?.[0];
  }, [panelLayers, activeLayerId]);
  const [analysisImageDataByRequestKey, setAnalysisImageDataByRequestKey] =
    useState<Record<string, PanelLayerI["imageData"] | null>>({});
  const [seriesImageDataByRequestKey, setSeriesImageDataByRequestKey] =
    useState<Record<string, PanelLayerI["imageData"] | null>>({});

  const yearOptions = useMemo(() => getAnalysisYearOptions(dataset), [dataset]);

  const effectiveYear = useMemo(
    () => getEffectiveAnalysisYear(dataset, activeYear),
    [dataset, activeYear],
  );

  const activeAnalysisYear =
    effectiveYear ?? yearOptions[0]?.value ?? "general";

  const municipalAnalysisRequestKey = dataset?.id
    ? getMunicipalAnalysisRequestKey(dataset.id, activeAnalysisYear)
    : null;
  const municipalSeriesRequestKey =
    dataset?.id &&
    dataset.reportSeriesConfig?.datasetVersion &&
    selectedMunicipalityCode
      ? getMunicipalSeriesRequestKey(
          dataset.id,
          dataset.reportSeriesConfig.datasetVersion,
          selectedMunicipalityCode,
        )
      : null;

  useEffect(() => {
    if (
      !dataset?.id ||
      !municipalAnalysisRequestKey ||
      !selectedMunicipalityCode ||
      analysisImageDataByRequestKey[municipalAnalysisRequestKey] !== undefined
    ) {
      return;
    }

    const yearKey = getMunicipalAnalysisRequestYear(
      municipalAnalysisRequestKey,
    );
    const availabilityIndex =
      municipalAvailabilityIndex as MunicipalAvailabilityIndex;

    if (
      !yearKey ||
      !hasMunicipalLayerPeriod(
        availabilityIndex,
        selectedMunicipalityCode,
        dataset.id,
        yearKey,
      )
    ) {
      return;
    }

    const controller = new AbortController();

    const requestUrl = new URL(
      `/api/municipal-analysis/${encodeURIComponent(dataset.id)}`,
      window.location.origin,
    );
    requestUrl.searchParams.set("year", yearKey);

    const fetchActivePeriod = async () => {
      let imageData: PanelLayerI["imageData"] | null = null;

      try {
        const response = await fetch(requestUrl.toString(), {
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Municipal analysis request failed with status ${response.status}`,
          );
        }

        const data = (await response.json()) as MunicipalAnalysisApiResponse;
        imageData = data.imageData ?? null;
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.warn("Falha ao carregar municipalAnalysis sob demanda.", error);
      }

      setAnalysisImageDataByRequestKey((current) => ({
        ...current,
        [municipalAnalysisRequestKey]: imageData,
      }));
    };

    void fetchActivePeriod();

    return () => {
      controller.abort();
    };
  }, [
    analysisImageDataByRequestKey,
    dataset?.id,
    municipalAnalysisRequestKey,
    selectedMunicipalityCode,
  ]);

  useEffect(() => {
    if (
      !dataset?.id ||
      !selectedMunicipalityCode ||
      !municipalSeriesRequestKey ||
      seriesImageDataByRequestKey[municipalSeriesRequestKey] !== undefined
    ) {
      return;
    }

    const controller = new AbortController();
    const requestUrl = new URL(
      `/api/municipal-analysis/${encodeURIComponent(dataset.id)}/series`,
      window.location.origin,
    );
    requestUrl.searchParams.set("locationKey", selectedMunicipalityCode);

    const fetchMunicipalSeries = async () => {
      let imageData: PanelLayerI["imageData"] | null = null;

      try {
        const response = await fetch(requestUrl.toString(), {
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Municipal time series request failed with status ${response.status}`,
          );
        }

        const data = (await response.json()) as MunicipalAnalysisApiResponse;
        imageData = data.imageData ?? null;
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.warn("Falha ao carregar série municipal sob demanda.", error);
      }

      setSeriesImageDataByRequestKey((current) => ({
        ...current,
        [municipalSeriesRequestKey]: imageData,
      }));
    };

    void fetchMunicipalSeries();

    return () => {
      controller.abort();
    };
  }, [
    dataset?.id,
    municipalSeriesRequestKey,
    selectedMunicipalityCode,
    seriesImageDataByRequestKey,
  ]);

  const enrichedDataset = useMemo(() => {
    if (!dataset?.id) {
      return dataset;
    }

    const partialImageData = municipalAnalysisRequestKey
      ? analysisImageDataByRequestKey[municipalAnalysisRequestKey]
      : null;

    if (!partialImageData) {
      return dataset;
    }

    return {
      ...dataset,
      imageData: mergePartialMunicipalImageData(
        dataset.imageData,
        partialImageData,
      ),
    };
  }, [analysisImageDataByRequestKey, dataset, municipalAnalysisRequestKey]);

  const temporalEnrichedDataset = useMemo(() => {
    if (!dataset?.id) {
      return enrichedDataset;
    }

    if (municipalSeriesRequestKey) {
      const seriesImageData =
        seriesImageDataByRequestKey[municipalSeriesRequestKey];

      if (!seriesImageData) {
        return enrichedDataset;
      }

      return {
        ...dataset,
        imageData: mergePartialMunicipalImageData(
          dataset.imageData,
          seriesImageData,
        ),
      };
    }

    const availablePatches = yearOptions
      .map(
        (option) =>
          analysisImageDataByRequestKey[
            getMunicipalAnalysisRequestKey(dataset.id, option.value)
          ],
      )
      .filter((patch) => patch !== undefined);

    if (availablePatches.length === 0) {
      return enrichedDataset;
    }

    return {
      ...dataset,
      imageData: mergeMultiplePartialMunicipalImageData(
        dataset.imageData,
        availablePatches,
      ),
    };
  }, [
    analysisImageDataByRequestKey,
    dataset,
    enrichedDataset,
    municipalSeriesRequestKey,
    seriesImageDataByRequestKey,
    yearOptions,
  ]);

  function handleGoBack() {
    resetPlatformState();
    onRequestSectionChange?.("monitoring");
  }

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

  const spatialScopeLocationKey = getSpatialScopeLocationKey(spatialSelection);
  const selectedLocationKey =
    selectedMunicipalityCode ??
    (selectedState !== "br" ? selectedState : null) ??
    spatialScopeLocationKey ??
    "br";

  const embeddedModel = useMemo(
    () =>
      buildEmbeddedTerritorialAnalysisViewModel(
        enrichedDataset,
        effectiveYear,
        selectedLocationKey,
        tCaption,
      ),
    [enrichedDataset, effectiveYear, selectedLocationKey, tCaption],
  );

  const unavailableLocationName = useMemo(() => {
    const explicitLocationName = getAnalysisLocationName(
      enrichedDataset,
      effectiveYear,
      selectedLocationKey,
    );

    if (explicitLocationName) {
      return explicitLocationName;
    }

    return selectedLocationKey === spatialScopeLocationKey
      ? getSpatialScopeLocationName(spatialSelection)
      : getFallbackAnalysisLocationName(selectedLocationKey);
  }, [
    effectiveYear,
    enrichedDataset,
    selectedLocationKey,
    spatialScopeLocationKey,
    spatialSelection,
  ]);

  useEffect(() => {
    if (!enrichedDataset?.imageData || !effectiveYear) {
      setActiveLegend(null);
      return;
    }
    setActiveLegend(getAnalysisLegend(enrichedDataset, effectiveYear));
  }, [enrichedDataset, effectiveYear, setActiveLegend]);

  // Extract years and classes only when imageData is CompactTerritorialAnalysisDataset
  const temporalYears =
    temporalEnrichedDataset?.imageData &&
    "years" in temporalEnrichedDataset.imageData
      ? (temporalEnrichedDataset.imageData as CompactTerritorialAnalysisDataset)
          .years
      : undefined;

  const temporalClasses =
    temporalEnrichedDataset?.imageData &&
    "classes" in temporalEnrichedDataset.imageData
      ? (temporalEnrichedDataset.imageData as CompactTerritorialAnalysisDataset)
          .classes
      : undefined;
  const activeMunicipalAnalysisKnownUnavailable = Boolean(
    selectedMunicipalityCode &&
    dataset?.id &&
    !hasMunicipalLayerPeriod(
      municipalAvailabilityIndex as MunicipalAvailabilityIndex,
      selectedMunicipalityCode,
      dataset.id,
      activeAnalysisYear,
    ),
  );
  const isMunicipalAnalysisLoading = Boolean(
    selectedMunicipalityCode &&
    municipalAnalysisRequestKey &&
    !activeMunicipalAnalysisKnownUnavailable &&
    analysisImageDataByRequestKey[municipalAnalysisRequestKey] === undefined,
  );

  const handleSpatialSelectionChange = useCallback(
    (value: SpatialSelection) => {
      setSpatialSelection(value);
      setSelectedState("br");
      setSelectedMunicipalityCode(null);
    },
    [setSpatialSelection, setSelectedMunicipalityCode, setSelectedState],
  );

  return (
    <AnalysisPanel
      moduleName={dataset?.name}
      yearOptions={yearOptions}
      activeYear={activeAnalysisYear}
      spatialSelection={spatialSelection}
      onSpatialSelectionChange={handleSpatialSelectionChange}
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
      emptyStateTitle={t("unavailableTitle", {
        location: unavailableLocationName,
      })}
      emptyStateDescription={
        isMunicipalAnalysisLoading
          ? t("unavailableDescriptionLoading")
          : t("unavailableDescription", { location: unavailableLocationName })
      }
    />
  );
}
