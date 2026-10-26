"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { MapLayerProvider } from "@/components/MapLayerContext/MapLayerContext";
import { AmfeAnalysisProvider } from "@/components/Amfe/AmfeAnalysisContext";
import { AmfeAnalysisFormColumn } from "@/components/Amfe/AmfeAnalysisFormColumn";
import { PlatformMap } from "@/components/PlatformMap/PlatformMap";
import type { PlatformMapSection } from "@/components/PlatformMap/PlatformMap";
import { PlatformSidebar } from "@/components/PlatformSidebar/PlatformSidebar";
import type { PlatformSidebarInitialSection } from "@/components/PlatformSidebar/PlatformSidebar";
import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";
import { PLATFORM_SHELL_MIN_HEIGHT_CLASS } from "./platformShell";
import type { PanelLayerI } from "@/utils/interfaces";

type DefaultPlatformLayoutProps = {
  panelLayers: PanelLayerI[];
  detailLayerId?: string;
  showAuditLink?: boolean;
  initialSection?: PlatformSidebarInitialSection;
  viewMode?: "default";
  telemetryDashboard?: never;
  reportRequest?: {
    locationKey: string;
    period: string;
    layerIds: string[];
  };
};

type LogsPlatformLayoutProps = {
  showAuditLink?: boolean;
  initialSection?: PlatformSidebarInitialSection;
  viewMode: "logs";
  telemetryDashboard: ReactNode;
  panelLayers?: never;
  reportRequest?: never;
};

type CatalogPlatformLayoutProps = {
  showAuditLink?: boolean;
  initialSection?: PlatformSidebarInitialSection;
  viewMode: "catalog";
  catalogDashboard: ReactNode;
  panelLayers?: never;
  telemetryDashboard?: never;
  reportRequest?: never;
};

type PlatformLayoutProps =
  | DefaultPlatformLayoutProps
  | LogsPlatformLayoutProps
  | CatalogPlatformLayoutProps;

function resolveMapSection(activeSection: PlatformSection): PlatformMapSection {
  if (activeSection === "analysis") return "analysis";
  if (activeSection === "communication") return "communication";
  return "monitoring";
}

/**
 * No celular não cabem as opções e o resultado lado a lado, então a tela mostra
 * um de cada vez: "options" é o painel (ou o formulário da Priorização) e
 * "result" é o que está por baixo dele — o mapa, ou o relatório na Comunicação.
 */
type MobileView = "options" | "result";

/**
 * O botão flutuante que troca entre as opções e o resultado no celular. Some no
 * computador, onde os dois já aparecem juntos.
 */
function MobileViewToggle({
  section,
  view,
  onChange,
}: {
  section: PlatformSection;
  view: MobileView;
  onChange: (next: MobileView) => void;
}) {
  const t = useTranslations("PlatformSideRail");
  const showsOptions = view === "options";
  const label = !showsOptions
    ? t("mobileShowOptions")
    : section === "communication"
      ? t("mobileShowReport")
      : t("mobileShowMap");

  // Enquanto a pessoa digita numa busca ou escolhe na lista dela, o botão
  // some: ele ficava por cima das opções e, com o teclado aberto, do campo.
  return (
    <button
      type="button"
      onClick={() => onChange(showsOptions ? "result" : "options")}
      data-mobile-view-toggle
      className="fixed bottom-20 left-1/2 z-40 flex h-11 -translate-x-1/2 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full bg-[#5B612A] px-5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(33,36,15,0.3)] transition-[scale] duration-200 active:scale-95 md:hidden group-has-[[role=combobox]:focus]/shell:hidden group-has-[[role=combobox][aria-expanded=true]]/shell:hidden"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {showsOptions ? (
          // Mapa dobrado: vai para o mapa (ou para o relatório).
          <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14" />
        ) : (
          // Lista: volta para as opções.
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        )}
      </svg>
      {label}
    </button>
  );
}

export function PlatformLayout({
  showAuditLink = false,
  initialSection = "monitoring",
  ...props
}: PlatformLayoutProps) {
  const viewMode = props.viewMode ?? "default";
  const isLogsView = props.viewMode === "logs";
  const isCatalogView = props.viewMode === "catalog";
  const sidebarStateKey = `${viewMode}:${initialSection}`;
  const sidebarPanelLayers =
    props.viewMode === "logs" || props.viewMode === "catalog"
      ? []
      : props.panelLayers;
  const [activeSection, setActiveSection] =
    useState<PlatformSection>(initialSection);
  // Ir para Auditoria ou Catálogo e voltar é a mesma página com outros
  // parâmetros, então este estado sobrevive à ida. A barra lateral recomeça
  // pela `key`; a seção do mapa precisa recomeçar junto, ou a Análise que
  // estava aberta antes reaparece sobre o Monitoramento.
  const [sectionStateKey, setSectionStateKey] = useState(sidebarStateKey);
  if (sectionStateKey !== sidebarStateKey) {
    setSectionStateKey(sidebarStateKey);
    setActiveSection(initialSection);
  }

  // Quem chega por um link de relatório quer ver o relatório; os demais
  // começam pelas opções. Um relatório novo pedido pelo formulário chega como
  // outra URL, e aí a tela vai sozinha para ele.
  const reportRequest =
    props.viewMode === "logs" || props.viewMode === "catalog"
      ? undefined
      : props.reportRequest;
  const reportKey = reportRequest ? JSON.stringify(reportRequest) : "";
  const [mobileView, setMobileView] = useState<MobileView>(
    reportKey && initialSection === "communication" ? "result" : "options",
  );
  const [seenReportKey, setSeenReportKey] = useState(reportKey);
  if (seenReportKey !== reportKey) {
    setSeenReportKey(reportKey);
    if (reportKey) setMobileView("result");
  }

  function handleActiveSectionChange(next: PlatformSection) {
    setActiveSection(next);
    setMobileView("options");
  }

  return (
    <MapLayerProvider>
      <AmfeAnalysisProvider>
        {/* Toda seção começa na mesma altura: o que sobra da viewport abaixo do
            cabeçalho. O rodapé vem logo depois, fora da dobra, e só aparece
            quando a pessoa rola. */}
        {/* No celular a casca termina onde começa a barra de seções (h-16),
            e `dvh` acompanha a barra de endereço do navegador, que aparece e
            some ao rolar. */}
        <div
          data-platform-shell
          data-mobile-view={mobileView}
          className={`group/shell relative flex w-full flex-col bg-neutral-50 ${PLATFORM_SHELL_MIN_HEIGHT_CLASS} max-md:min-h-[calc(100dvh-66px-4rem)]`}
        >
          {/* A trilha e o painel vêm antes do mapa no código, na ordem em que
              aparecem na tela: antes o Tab passava pelo mapa e pelos controles
              dele antes de chegar às seções e às camadas. */}
          <PlatformSidebar
            key={sidebarStateKey}
            panelLayers={sidebarPanelLayers}
            showAuditLink={showAuditLink}
            initialSection={initialSection}
            detailLayerId={
              props.viewMode === "logs" || props.viewMode === "catalog"
                ? undefined
                : props.detailLayerId
            }
            viewMode={viewMode}
            reportRequest={
              props.viewMode === "logs" || props.viewMode === "catalog"
                ? undefined
                : props.reportRequest
            }
            onActiveSectionChange={handleActiveSectionChange}
          />
          {isLogsView ? (
            // Telemetria e catálogo são telas internas escritas só em
            // português: o `lang` evita que o leitor de tela as leia com a
            // pronúncia do inglês ou do espanhol quando o site está nesses idiomas.
            <div
              data-testid="platform-logs-shell"
              lang="pt-BR"
              className="w-full"
            >
              {props.telemetryDashboard}
            </div>
          ) : isCatalogView ? (
            <div
              data-testid="platform-catalog-shell"
              lang="pt-BR"
              // No celular a trilha vira a barra de baixo: o recuo de 132 px
              // que abre espaço para ela deixava uma faixa vazia à esquerda.
              className={`w-full pl-[132px] max-md:pl-0 ${PLATFORM_SHELL_MIN_HEIGHT_CLASS}`}
            >
              {props.catalogDashboard}
            </div>
          ) : (
            <>
              {/* Monitoramento, Análise e Comunicação compartilham este mapa:
                  trocar de seção muda as propriedades dele, não a instância. */}
              {/* O formulário da Priorização fica à esquerda do mapa, então
                  vem antes dele também para o Tab. */}
              {activeSection === "analysis" && (
                <AmfeAnalysisFormColumn
                  onAnalyze={() => setMobileView("result")}
                />
              )}
              <PlatformMap
                section={resolveMapSection(activeSection)}
                showMonitoringControls={activeSection === "monitoring"}
              />
            </>
          )}
          {!isLogsView && !isCatalogView && (
            <MobileViewToggle
              section={activeSection}
              view={mobileView}
              onChange={setMobileView}
            />
          )}
        </div>
      </AmfeAnalysisProvider>
    </MapLayerProvider>
  );
}
