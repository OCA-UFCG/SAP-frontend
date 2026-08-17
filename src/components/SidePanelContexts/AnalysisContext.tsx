"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AnalysisPanel } from "@/components/analysis/AnalysisPanel";
import type { SearchSubmissionMetadata } from "@/components/SearchBar/types";
import type { SpatialSelection } from "@/utils/spatialScope";
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
import { getAllowedStateUfs } from "@/utils/interestAreaStates";
import {
  mergePartialMunicipalImageData,
  mergeMultiplePartialMunicipalImageData,
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
  } =
    useMapLayerViewState();

  const dataset = useMemo(() => {
    return panelLayers?.find((p) => p.id === activeLayerId) ?? panelLayers?.[0];
  }, [panelLayers, activeLayerId]);
  const [analysisImageDataByRequestKey, setAnalysisImageDataByRequestKey] =
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

  const hasMunicipalitySelected = Boolean(selectedMunicipalityCode);
  const temporalMunicipalAnalysisRequestKeys = useMemo(() => {
    if (!dataset?.id || !hasMunicipalitySelected) {
      return [];
    }
    return yearOptions.map((option) =>
      getMunicipalAnalysisRequestKey(dataset.id, option.value),
    );
  }, [dataset, hasMunicipalitySelected, yearOptions]);

  useEffect(() => {
    if (!dataset?.id || !municipalAnalysisRequestKey) {
      return;
    }

    const availabilityIndex =
      municipalAvailabilityIndex as MunicipalAvailabilityIndex;
    const requestKeys = [
      municipalAnalysisRequestKey,
      ...temporalMunicipalAnalysisRequestKeys,
    ].filter((requestKey, index, allRequestKeys) => {
      const yearKey = getMunicipalAnalysisRequestYear(requestKey);

      return (
        allRequestKeys.indexOf(requestKey) === index &&
        analysisImageDataByRequestKey[requestKey] === undefined &&
        (!selectedMunicipalityCode ||
          !yearKey ||
          hasMunicipalLayerPeriod(
            availabilityIndex,
            selectedMunicipalityCode,
            dataset.id,
            yearKey,
          ))
      );
    });

    if (requestKeys.length === 0) {
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;

    const fetchInBatches = async () => {
      const chunkSize = 10;
      for (let i = 0; i < requestKeys.length; i += chunkSize) {
        if (signal.aborted) {
          return;
        }

        const chunk = requestKeys.slice(i, i + chunkSize);
        const results = await Promise.all(
          chunk.map(async (requestKey) => {
            const yearKey = getMunicipalAnalysisRequestYear(requestKey);
            if (!yearKey) return { requestKey, data: null };

            const requestUrl = new URL(
              `/api/municipal-analysis/${encodeURIComponent(dataset.id)}`,
              window.location.origin,
            );
            requestUrl.searchParams.set("year", yearKey);

            try {
              const response = await fetch(requestUrl.toString(), {
                credentials: "same-origin",
                signal,
              });

              if (!response.ok) {
                console.warn(
                  `Municipal analysis request failed with status ${response.status}`,
                );
                return { requestKey, data: null };
              }

              const data =
                (await response.json()) as MunicipalAnalysisApiResponse;
              return { requestKey, data: data.imageData ?? null };
            } catch (error) {
              if (!signal.aborted) {
                console.warn(
                  "Falha ao carregar municipalAnalysis sob demanda.",
                  error,
                );
              }
              return { requestKey, data: null };
            }
          }),
        );

        if (signal.aborted) {
          return;
        }

        const newEntries: Record<string, PanelLayerI["imageData"] | null> = {};
        for (const { requestKey, data } of results) {
          newEntries[requestKey] = data;
        }

        setAnalysisImageDataByRequestKey((current) => ({
          ...current,
          ...newEntries,
        }));
      }
    };

    fetchInBatches();

    return () => {
      controller.abort();
    };
  }, [
    analysisImageDataByRequestKey,
    dataset?.id,
    municipalAnalysisRequestKey,
    selectedMunicipalityCode,
    temporalMunicipalAnalysisRequestKeys,
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
    if (!dataset?.id || temporalMunicipalAnalysisRequestKeys.length === 0) {
      return enrichedDataset;
    }

    const availablePatches = temporalMunicipalAnalysisRequestKeys.map(
      (requestKey) => analysisImageDataByRequestKey[requestKey],
    );

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
    temporalMunicipalAnalysisRequestKeys,
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

  const selectedLocationKey = selectedMunicipalityCode ?? selectedState;

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

  const unavailableLocationName = useMemo(
    () =>
      getAnalysisLocationName(
        enrichedDataset,
        effectiveYear,
        selectedLocationKey,
      ) ?? getFallbackAnalysisLocationName(selectedLocationKey),
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
    municipalAnalysisRequestKey &&
    !activeMunicipalAnalysisKnownUnavailable &&
    analysisImageDataByRequestKey[municipalAnalysisRequestKey] === undefined,
  );

  const handleSpatialSelectionChange = useCallback(
    (value: SpatialSelection) => {
      setSpatialSelection(value);

      // O recorte mudou: se o estado selecionado não pertence ao novo
      // recorte, deseleciona para não manter a borda de seleção antiga.
      const allowedUfs = getAllowedStateUfs(value);
      if (
        allowedUfs &&
        selectedState !== "br" &&
        !allowedUfs.has(selectedState)
      ) {
        setSelectedState("br");
        setSelectedMunicipalityCode(null);
      }
    },
    [
      selectedState,
      setSpatialSelection,
      setSelectedMunicipalityCode,
      setSelectedState,
    ],
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
      emptyStateTitle={t("unavailableTitle", { location: unavailableLocationName })}
      emptyStateDescription={
        isMunicipalAnalysisLoading
          ? t("unavailableDescriptionLoading")
          : t("unavailableDescription", { location: unavailableLocationName })
      }
    />
  );
}
