"use client";

import { useEffect, useMemo } from "react";
import { AnalysisPanel } from "@/components/analysis/AnalysisPanel";
import {
  buildEmbeddedTerritorialAnalysisViewModel,
  getAnalysisLegend,
  getAnalysisLocationName,
  getAnalysisYearOptions,
  getEffectiveAnalysisYear,
} from "@/components/analysis/analysis.mappers";
import { useMapLayer } from "@/components/MapLayerContext/MapLayerContext";
import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";
import type { PanelLayerI, IEEInfo } from "@/utils/interfaces";
import { statesObj } from "@/utils/constants";
import { resolveStateKeyFromSearch } from "@/utils/functions";

export interface AnalysisContextProps {
  activeSection: PlatformSection;
  panelLayers?: PanelLayerI[];
  eeConfigs?: IEEInfo[];
  onRequestSectionChange?: (next: PlatformSection) => void;
}

export function AnalysisContext({
  onRequestSectionChange,
  panelLayers,
}: AnalysisContextProps) {
  const {
    setActiveData,
    setSelectedState,
    setActiveLayerId,
    setActiveEEData,
    setActiveLegend,
    selectedState,
    activeLayerId,
    activeYear,
    setActiveYear,
  } = useMapLayer();
  // activeData eh o dado vetorial para o mapa renderizar (CDIVectorData)
  // activeLayerId eh o identificador da layer selecionada ("CDI" e etc)

  const dataset = useMemo(() => {
    return panelLayers?.find((p) => p.id === activeLayerId) ?? panelLayers?.[0];
  }, [panelLayers, activeLayerId]);

  const yearOptions = useMemo(() => getAnalysisYearOptions(dataset), [dataset]);

  function handleGoBack() {
    setActiveLayerId(null);
    setActiveEEData(null);
    setActiveData(null);
    setActiveLegend(null);
    setActiveYear("general");
    setSelectedState("br");
    onRequestSectionChange?.("modules");
  }

  const handleSearch = (value: string) => {
    const result = resolveStateKeyFromSearch(value, statesObj);
    setSelectedState(result.key);
  };

  const effectiveYear = useMemo(
    () => getEffectiveAnalysisYear(dataset, activeYear),
    [dataset, activeYear],
  );

  const activeAnalysisYear =
    effectiveYear ?? yearOptions[0]?.value ?? "general";

  const embeddedModel = useMemo(
    () =>
      buildEmbeddedTerritorialAnalysisViewModel(
        dataset,
        effectiveYear,
        selectedState,
      ),
    [dataset, effectiveYear, selectedState],
  );

  const unavailableLocationName = useMemo(
    () =>
      getAnalysisLocationName(dataset, effectiveYear, selectedState) ??
      statesObj[selectedState as keyof typeof statesObj] ??
      (selectedState === "br" ? "Brasil" : selectedState.toUpperCase()),
    [dataset, effectiveYear, selectedState],
  );

  useEffect(() => {
    if (!dataset?.imageData || !effectiveYear) {
      setActiveLegend(null);
      return;
    }

    setActiveLegend(getAnalysisLegend(dataset, effectiveYear));
  }, [dataset, effectiveYear, setActiveLegend]);

  return (
    <AnalysisPanel
      moduleName={dataset?.name}
      yearOptions={yearOptions}
      activeYear={activeAnalysisYear}
      onBack={handleGoBack}
      onSearch={handleSearch}
      onYearChange={setActiveYear}
      onRankingItemSelect={setSelectedState}
      model={embeddedModel}
      emptyStateTitle={`Análise indisponível para ${unavailableLocationName}`}
      emptyStateDescription={`Os dados de análise para ${unavailableLocationName} ainda não estão disponíveis neste módulo.`}
    />
  );
}
