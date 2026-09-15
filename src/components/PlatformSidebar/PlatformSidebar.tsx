"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "@/translations/routing";
import {
  PlatformSection,
  PlatformSideRail,
} from "@/components/PlatformSideRail/PlatformSideRail";
import { PlatformSidePanel } from "@/components/PlatformSidePanel/PlatformSidePanel";
import { AnalysisContext } from "@/components/SidePanelContexts/AnalysisContext";
import { ComingSoonContext } from "@/components/SidePanelContexts/ComingSoonContext";
import { MunicipalReportContext } from "@/components/SidePanelContexts/MunicipalReportContext";
import { PanelLayerI } from "@/utils/interfaces";
import { useMapLayerActions } from "@/components/MapLayerContext/MapLayerContext";
import type { MunicipalReportPreviewProps } from "@/components/MunicipalReport/MunicipalReportPreview";

// O relatório municipal carrega o `recharts` junto. Ele só aparece na seção de
// Comunicação, então importá-lo sob demanda tira essa biblioteca do pacote que
// todo mundo baixa ao abrir a plataforma.
const LazyMunicipalReportPreview = dynamic<MunicipalReportPreviewProps>(
  () =>
    import("@/components/MunicipalReport/MunicipalReportPreview").then(
      (module) => ({ default: module.MunicipalReportPreview }),
    ),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-[#F6F7F6]" />,
  },
);

export type PlatformSidebarInitialSection =
  "monitoring" | "analysis" | "communication";

export type PlatformSidebarViewMode = "default" | "logs" | "catalog";

function buildSidebarState(
  viewMode: PlatformSidebarViewMode,
  initialSection: PlatformSidebarInitialSection,
) {
  if (viewMode === "logs") {
    return {
      activeSection: "logs" as const,
      panelSection: "monitoring" as const,
      isPanelOpen: false,
    };
  }

  if (viewMode === "catalog") {
    return {
      activeSection: "catalog" as const,
      panelSection: "monitoring" as const,
      isPanelOpen: false,
    };
  }

  // Análise ocupa a faixa do painel com o próprio formulário, então entra com o
  // painel recolhido — e sem trocar a seção dele, que reaparece intacta ao
  // voltar para Monitoramento.
  if (initialSection === "analysis") {
    return {
      activeSection: "analysis" as const,
      panelSection: "monitoring" as const,
      isPanelOpen: false,
    };
  }

  return {
    activeSection: initialSection,
    panelSection: initialSection,
    isPanelOpen: true,
  };
}

function buildPlatformHref(section: PlatformSidebarInitialSection) {
  if (section === "monitoring") {
    return "/platform";
  }

  if (section === "analysis") {
    return "/platform/amfe";
  }

  return `/platform?section=${section}`;
}

interface PlatformSidebarProps {
  panelLayers: PanelLayerI[];
  showAuditLink?: boolean;
  initialSection?: PlatformSidebarInitialSection;
  viewMode?: PlatformSidebarViewMode;
  reportRequest?: {
    municipalityCode: string;
    period: string;
    layerIds: string[];
  };
  detailLayerId?: string;
  onActiveSectionChange?: (section: PlatformSection) => void;
}

export function PlatformSidebar({
  panelLayers,
  showAuditLink = false,
  initialSection = "monitoring",
  viewMode = "default",
  reportRequest,
  detailLayerId,
  onActiveSectionChange,
}: PlatformSidebarProps) {
  const router = useRouter();
  const { setActiveLegend } = useMapLayerActions();
  const initialSidebarState = buildSidebarState(viewMode, initialSection);
  // Auditoria e catálogo substituem o mapa e trazem o próprio conteúdo: o
  // sidebar não deve abrir painel por cima deles.
  const isUtilityView = viewMode === "logs" || viewMode === "catalog";

  const [activeSection, setActiveSection] = useState<PlatformSection>(
    initialSidebarState.activeSection,
  );
  const [panelSection, setPanelSection] = useState<PlatformSection>(
    initialSidebarState.panelSection,
  );
  const [isPanelOpen, setIsPanelOpen] = useState(
    initialSidebarState.isPanelOpen,
  );
  const [requestedDetailLayerId, setRequestedDetailLayerId] = useState<
    string | undefined
  >(detailLayerId);
  // Sair de auditoria ou do catálogo ainda é uma navegação, e ela espera o
  // servidor. O `useTransition` mantém a trilha na tela e marca o item clicado
  // como em andamento em vez de deixar a tela parada.
  const [isLeavingUtilityView, startUtilityViewExit] = useTransition();
  const [utilityViewExitTarget, setUtilityViewExitTarget] =
    useState<PlatformSection | null>(null);
  const defaultPanelOpenOffset = "560px";
  const sidePanelWidthClass = isPanelOpen ? "w-[420px]" : "w-0";

  // A lateral flutua por cima do mapa full-bleed, entao quem desenha algo no
  // canto inferior esquerdo do mapa (a escala) precisa saber quanto dele esta
  // coberto. Publicar a medida evita subir `isPanelOpen` ate o layout so para
  // isso; quem consome le `--platform-side-overlay-width`.
  useEffect(() => {
    const overlayWidth = isPanelOpen ? defaultPanelOpenOffset : "140px";
    document.documentElement.style.setProperty(
      "--platform-side-overlay-width",
      overlayWidth,
    );
    return () => {
      document.documentElement.style.removeProperty(
        "--platform-side-overlay-width",
      );
    };
  }, [isPanelOpen]);

  const ContextComponent =
    panelSection === "monitoring"
      ? undefined
      : panelSection === "analysis-detail"
        ? AnalysisContext
        : panelSection === "analysis"
          ? ComingSoonContext
          : panelSection === "communication"
            ? MunicipalReportContext
            : undefined;

  // Auditoria e catálogo são outras páginas: sair delas exige navegar. Dentro
  // da plataforma, trocar de seção é estado de cliente — é o que mantém o mapa
  // montado e a troca em dezenas de milissegundos em vez de perto de um segundo.
  function handleSectionChange(next: PlatformSection) {
    if (isUtilityView) {
      const href =
        next === "analysis" || next === "communication"
          ? buildPlatformHref(next)
          : buildPlatformHref("monitoring");

      setUtilityViewExitTarget(next);
      startUtilityViewExit(() => router.push(href));
      return;
    }

    if (next === "analysis") {
      // A legenda do Monitoramento não descreve a coropleta da análise.
      setActiveLegend(null);
    }

    setActiveSection(next);
    onActiveSectionChange?.(next);
    setIsPanelOpen(next !== "analysis");

    if (next !== "analysis") {
      setPanelSection(next);
    }
  }

  const openLayerMonitoring = useCallback((layerId: string) => {
    setRequestedDetailLayerId(layerId);
    setActiveSection("monitoring");
    setPanelSection("monitoring");
    setIsPanelOpen(true);
  }, []);

  function handlePanelSectionChange(next: PlatformSection) {
    if (next === "analysis-detail") setRequestedDetailLayerId(undefined);

    setPanelSection(next);

    if (next === "monitoring" && activeSection === "analysis-detail") {
      setActiveSection("monitoring");
      onActiveSectionChange?.("monitoring");
    }

    setIsPanelOpen(true);
  }

  return (
    <>
      <aside
        className="absolute left-0 top-0 z-20 flex h-full"
        data-platform-sidebar-overlay
      >
        <PlatformSideRail
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          isPanelOpen={isPanelOpen}
          onTogglePanel={() => setIsPanelOpen((v) => !v)}
          showAuditLink={showAuditLink}
          pendingSection={isLeavingUtilityView ? utilityViewExitTarget : null}
        />

        {!isUtilityView && (
          <div
            data-platform-side-panel
            className={`
        relative h-full overflow-hidden
          transition-[width] duration-300 ease-in-out
          ${sidePanelWidthClass}
        `}
          >
            <div
              className={`
            absolute left-0 top-0 h-full w-full
            transform transition-transform duration-300 ease-in-out
            ${isPanelOpen ? "translate-x-0" : "-translate-x-full"}
          `}
            >
              <PlatformSidePanel
                activeSection={panelSection}
                panelLayers={panelLayers}
                ContextComponent={ContextComponent}
                detailLayerId={requestedDetailLayerId}
                onRequestSectionChange={handlePanelSectionChange}
              />
            </div>
          </div>
        )}
      </aside>

      {activeSection === "communication" && !isUtilityView && (
        <>
          <div
            className="absolute inset-0 z-[5] bg-[#F6F7F6]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-0 right-0 z-10 bg-[#F6F7F6] transition-[left] duration-300 ease-in-out"
            style={{ left: isPanelOpen ? defaultPanelOpenOffset : "140px" }}
          >
            <LazyMunicipalReportPreview
              municipalityCode={reportRequest?.municipalityCode ?? ""}
              period={reportRequest?.period ?? ""}
              layerIds={reportRequest?.layerIds ?? []}
              onOpenMonitor={openLayerMonitoring}
              embedded
            />
          </div>
        </>
      )}
    </>
  );
}
