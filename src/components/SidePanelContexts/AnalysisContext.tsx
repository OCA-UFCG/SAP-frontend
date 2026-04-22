"use client";

import { useEffect, useMemo } from "react";
import { AnalysisPanel } from "@/components/analysis/AnalysisPanel";
import {
  buildEmbeddedTerritorialAnalysisViewModel,
  buildLegacyTerritorialAnalysisViewModel,
  getAnalysisConfig,
  getAnalysisYearOptions,
  getEffectiveAnalysisYear,
} from "@/components/analysis/analysis.mappers";
import { useMapLayer } from "@/components/MapLayerContext/MapLayerContext";
import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";
import type { PanelLayerI, IEEInfo } from "@/utils/interfaces";
import { statesObj } from "@/utils/constants";
import { resolveStateKeyFromSearch } from "@/utils/functions";
import droughtData from "../../../public/dados-seca.json";
import type { ClassificationKey } from "@/utils/constants";
import { ClassificationCard } from "../ClassificationCard/ClassificationCard";

export interface AnalysisContextProps {
  activeSection: PlatformSection;
  panelLayers?: PanelLayerI[];
  eeConfigs?: IEEInfo[];
  onRequestSectionChange?: (next: PlatformSection) => void;
}

const CLASSIFICATION_KEYS: ClassificationKey[] = [
  "sem-seca",
  "recuperacao-total",
  "recuperacao-parcial",
  "observacao",
  "atencao",
  "alerta",
];

export interface LocationData {
  nome: string;
  status: Record<ClassificationKey, number>;
  acontecendo: string;
  impacto: string[];
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

  const locationData = useMemo(() => {
    return (
      droughtData[selectedState as keyof typeof droughtData] ||
      droughtData["br"]
    );
  }, [selectedState]);

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

  const activeAnalysisYear = effectiveYear ?? yearOptions[0]?.value ?? "general";

  const embeddedModel = useMemo(
    () => buildEmbeddedTerritorialAnalysisViewModel(
      getAnalysisConfig(dataset, effectiveYear),
      selectedState,
    ),
    [dataset, effectiveYear, selectedState],
  );

  const analysisModel = useMemo(
    () => embeddedModel ?? buildLegacyTerritorialAnalysisViewModel(locationData),
    [embeddedModel, locationData],
  );

  const rankingFallback = embeddedModel ? null : (
    <div className="flex flex-col gap-2">
      {CLASSIFICATION_KEYS.map((key) => (
        <ClassificationCard key={key} classificationKey={key} />
      ))}
    </div>
  );

  useEffect(() => {
    if (!dataset?.imageData || !effectiveYear) {
      setActiveLegend(null);
      return;
    }

    const yearConfig = dataset.imageData[effectiveYear];
    setActiveLegend(yearConfig?.imageParams ?? null);
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
      model={analysisModel}
      rankingFallback={rankingFallback}
    />
  );
}

