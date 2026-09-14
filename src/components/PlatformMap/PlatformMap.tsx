"use client";

import MapComponent from "../Map/MapComponent";
import type { MapProps } from "../Map/Map";
import { BRAZIL_TERRITORY_CODE } from "../Map/stateSelection";
import { useOptionalAmfeAnalysis } from "@/components/Amfe/AmfeAnalysisContext";
import { AmfeAnalysisStatusLines } from "@/components/Amfe/AmfeAnalysisStatusLines";
import { AmfeMapOverlays } from "@/components/Amfe/AmfeMapOverlays";
import type { AmfeAnalysisState } from "@/components/Amfe/useAmfeAnalysisState";
import { MonitoringMapOverlays } from "./MonitoringMapOverlays";
import {
  PLATFORM_MAP_CENTER,
  PLATFORM_MAP_INITIAL_ZOOM,
  PLATFORM_MAP_MIN_ZOOM,
} from "./platformMapView";
import {
  useMonitoringMapLayers,
  type MonitoringMapLayers,
} from "./useMonitoringMapLayers";

export type PlatformMapSection = "monitoring" | "analysis" | "communication";

/** `estadoSelecionado` é obrigatório no mapa; o resto cada seção preenche. */
type SectionMapProps = Partial<MapProps> & Pick<MapProps, "estadoSelecionado">;

// Em Análise o mapa começa depois da trilha (140px) e do formulário (600px), e
// repete a moldura arredondada que a tela da AMFE sempre teve.
const ANALYSIS_AREA_CLASS =
  "absolute inset-y-0 left-[740px] right-0 flex min-h-0 flex-col overflow-hidden p-6";
const ANALYSIS_FRAME_CLASS =
  "relative min-h-[520px] w-full flex-1 overflow-hidden rounded-xl border border-neutral-200";
const FULL_BLEED_AREA_CLASS = "absolute inset-0";
const FULL_BLEED_FRAME_CLASS = "relative z-10 flex h-full w-full";

function buildMonitoringMapProps(
  monitoring: MonitoringMapLayers,
): SectionMapProps {
  return {
    dadosCDI: monitoring.activeData ?? undefined,
    estadoSelecionado: monitoring.selectedState.toUpperCase(),
    selectedMunicipalityCode: monitoring.selectedMunicipalityCode,
    tileLayerUrl: monitoring.tileLayerUrl,
    tileLayerRequestKey: monitoring.requestKey,
    layerOpacity: monitoring.layerOpacity,
    // A camada de planilha é pintada pela coropleta, e a mesma barra de
    // opacidade do Monitoramento controla as duas — para quem usa, é uma
    // camada como as outras.
    municipalityClassification: monitoring.municipalityClassification,
    municipalityOverviewGeoJson: monitoring.municipalityOverviewGeoJson,
    classificationFillOpacity: monitoring.layerOpacity,
    allowedStateUfs: monitoring.allowedStateUfs,
    spatialBoundaryGeoJson: monitoring.boundaryGeoJson,
    spatialFocusBounds: monitoring.spatialFocusBounds,
    basemap: monitoring.basemap,
    referenceOverlayTileUrls: monitoring.referenceOverlayTileUrls,
    spatialArea: monitoring.spatialSelection.spatialArea,
    spatialValue: monitoring.spatialSelection.spatialValue,
    onStateSelect: (uf: string) =>
      monitoring.setSelectedState(uf.toLowerCase()),
    onSelectedMunicipalityCodeChange: monitoring.setSelectedMunicipalityCode,
    onSpatialSelectionChange: monitoring.handleSpatialSelectionChange,
    onTileLayerReady: monitoring.handleTileLayerReady,
  };
}

function buildAnalysisMapProps(analysis: AmfeAnalysisState): SectionMapProps {
  return {
    estadoSelecionado: BRAZIL_TERRITORY_CODE,
    allowedStateUfs: analysis.allowedStateUfs,
    spatialBoundaryGeoJson: analysis.boundaryGeoJson,
    spatialValue: analysis.spatialSelection.spatialValue,
    spatialFocusBounds: analysis.spatialFocusBounds,
    municipalityClassification: analysis.municipalityClassification,
    municipalityOverviewGeoJson: analysis.overviewGeoJson,
    classificationFillOpacity: analysis.fillOpacity,
    basemap: analysis.basemap,
    referenceOverlayTileUrls: analysis.referenceOverlayTileUrls,
    onZoomChange: analysis.setZoom,
  };
}

interface PlatformMapProps {
  section: PlatformMapSection;
  /** Os controles do mapa somem quando o painel abre os detalhes da camada. */
  showMonitoringControls?: boolean;
}

/**
 * A área de mapa da plataforma, nas três seções que a usam.
 *
 * Monitoramento e Análise pintam coisas diferentes — uma camada do Earth Engine
 * contra a coropleta da análise multicritério — mas é o mesmo mapa: só as
 * propriedades e a moldura mudam. Comunicação mantém o mapa montado por baixo do
 * relatório para que voltar dela não custe uma reconstrução.
 */
export function PlatformMap({
  section,
  showMonitoringControls = true,
}: PlatformMapProps) {
  const monitoring = useMonitoringMapLayers();
  const analysis = useOptionalAmfeAnalysis();
  const isAnalysis = section === "analysis" && analysis !== null;

  return (
    <div
      data-testid="platform-map-area"
      className={isAnalysis ? ANALYSIS_AREA_CLASS : FULL_BLEED_AREA_CLASS}
    >
      {isAnalysis && <AmfeAnalysisStatusLines />}

      {/* A moldura muda de forma entre as seções, mas o <MapComponent> ocupa
          sempre a mesma posição na árvore. É isso que mantém a instância do
          MapLibre viva ao trocar de seção, em vez de destruir uma e construir
          outra — o que media perto de um segundo por troca. */}
      <div
        className={isAnalysis ? ANALYSIS_FRAME_CLASS : FULL_BLEED_FRAME_CLASS}
      >
        <MapComponent
          mapMode="platform"
          center={PLATFORM_MAP_CENTER}
          zoom={PLATFORM_MAP_INITIAL_ZOOM}
          minZoom={PLATFORM_MAP_MIN_ZOOM}
          showStatesBorder
          className="h-full w-full"
          {...(isAnalysis && analysis
            ? buildAnalysisMapProps(analysis)
            : buildMonitoringMapProps(monitoring))}
        />

        {isAnalysis ? (
          <AmfeMapOverlays />
        ) : (
          <MonitoringMapOverlays
            monitoring={monitoring}
            showControls={showMonitoringControls}
          />
        )}
      </div>
    </div>
  );
}
