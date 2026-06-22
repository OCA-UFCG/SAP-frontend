"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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
import { mergePartialMunicipalImageData } from "@/utils/municipalAnalysisMerge";

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
    resetPlatformState,
  } = useMapLayerActions();
  const { selectedState, selectedMunicipalityCode, activeYear } =
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

  const temporalMunicipalAnalysisRequestKeys = useMemo(() => {
    if (!dataset?.id || !selectedMunicipalityCode) {
      return [];
    }

    return yearOptions.map((option) =>
      getMunicipalAnalysisRequestKey(dataset.id, option.value),
    );
  }, [dataset, selectedMunicipalityCode, yearOptions]);

  useEffect(() => {
    if (!dataset?.id || !municipalAnalysisRequestKey) {
      return;
    }

    const requestKeys = [
      municipalAnalysisRequestKey,
      ...temporalMunicipalAnalysisRequestKeys,
    ].filter(
      (requestKey, index, allRequestKeys) =>
        allRequestKeys.indexOf(requestKey) === index &&
        analysisImageDataByRequestKey[requestKey] === undefined,
    );

    if (requestKeys.length === 0) {
      return;
    }

    const controllers = requestKeys.map(() => new AbortController());

    requestKeys.forEach((requestKey, index) => {
      const yearKey = getMunicipalAnalysisRequestYear(requestKey);
      const controller = controllers[index];

      if (!yearKey || !controller) {
        return;
      }

      const requestUrl = new URL(
        `/api/municipal-analysis/${encodeURIComponent(dataset.id)}`,
        window.location.origin,
      );
      requestUrl.searchParams.set("year", yearKey);

      fetch(requestUrl.toString(), {
        credentials: "same-origin",
        signal: controller.signal,
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
          setAnalysisImageDataByRequestKey((current) => ({
            ...current,
            [requestKey]: data.imageData ?? null,
          }));
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            return;
          }

          console.warn(
            "Falha ao carregar municipalAnalysis sob demanda.",
            error,
          );
          setAnalysisImageDataByRequestKey((current) => ({
            ...current,
            [requestKey]: null,
          }));
        });
    });

    return () => {
      controllers.forEach((controller) => {
        controller.abort();
      });
    };
  }, [
    analysisImageDataByRequestKey,
    dataset?.id,
    municipalAnalysisRequestKey,
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

    return temporalMunicipalAnalysisRequestKeys.reduce<PanelLayerI | undefined>(
      (currentDataset, requestKey) => {
        const partialImageData = analysisImageDataByRequestKey[requestKey];

        if (!currentDataset || !partialImageData) {
          return currentDataset;
        }

        return {
          ...currentDataset,
          imageData: mergePartialMunicipalImageData(
            currentDataset.imageData,
            partialImageData,
          ),
        };
      },
      dataset,
    );
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
  const isMunicipalAnalysisLoading = Boolean(
    municipalAnalysisRequestKey &&
    analysisImageDataByRequestKey[municipalAnalysisRequestKey] === undefined,
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
      emptyStateTitle={t("unavailableTitle", { location: unavailableLocationName })}
      emptyStateDescription={
        isMunicipalAnalysisLoading
          ? t("unavailableDescriptionLoading")
          : t("unavailableDescription", { location: unavailableLocationName })
      }
    />
  );
}
