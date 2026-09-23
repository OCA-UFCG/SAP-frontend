"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnalysisContext } from "@/components/SidePanelContexts/AnalysisContext";
import { ModulesContext } from "@/components/SidePanelContexts/ModulesContext";
import { useMapLayerActions } from "@/components/MapLayerContext/MapLayerContext";
import { PlatformMap } from "@/components/PlatformMap/PlatformMap";
import type { IndexCatalogPreview } from "@/types/indexCatalog";
import {
  getImageDataLegend,
  getImageDataYearKeys,
  isCompactImageData,
} from "@/utils/imageData";
import type { IEEInfo, PanelLayerI } from "@/utils/interfaces";
import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";

/**
 * A prévia do Monitoramento precisa apenas da camada a desenhar.
 *
 * É menos que uma prévia validada de propósito, pela mesma razão da captura da
 * imagem do cartão: um índice legado adotado tem mapa, períodos e legenda sem
 * ter validação nenhuma, e é o mapa de verdade que o operador precisa ver antes
 * de publicar.
 */
export interface CatalogMonitoringPreviewSource {
  panelLayer: IndexCatalogPreview["panelLayer"];
}

export function CatalogMonitoringPreview({
  preview,
}: {
  preview: CatalogMonitoringPreviewSource;
}) {
  const [section, setSection] = useState<PlatformSection>("monitoring");
  const { activateEeLayer, resetPlatformState, setActiveYear } =
    useMapLayerActions();
  const panelLayer = useMemo(
    () => preview.panelLayer as PanelLayerI,
    [preview.panelLayer],
  );
  // O efeito abaixo desfaz as escolhas do operador (ano, território), então ele
  // só pode ler a camada, nunca depender da identidade dela.
  const panelLayerRef = useRef(panelLayer);
  const { id: panelLayerId, imageData } = panelLayer;

  useEffect(() => {
    panelLayerRef.current = panelLayer;
  }, [panelLayer]);

  // A prévia é remontada quando muda a camada desenhada — o id e o `imageData`
  // — e só então. Depender do objeto inteiro fazia a tela voltar ao ano padrão
  // e perder o município escolhido assim que a captura da imagem do cartão
  // terminava e gravava a URL dela dentro do mesmo `panelLayer`.
  useEffect(() => {
    resetPlatformState();
    const years = getImageDataYearKeys(imageData);
    const initialYear =
      (isCompactImageData(imageData) ? imageData.defaultYear : undefined) ??
      years.at(-1) ??
      "";

    if (initialYear) {
      setActiveYear(initialYear);
    }
    activateEeLayer(
      panelLayerRef.current as unknown as IEEInfo,
      getImageDataLegend(imageData),
    );

    return resetPlatformState;
  }, [
    activateEeLayer,
    imageData,
    panelLayerId,
    resetPlatformState,
    setActiveYear,
  ]);

  return (
    <section
      className="relative h-[720px] min-h-[620px] overflow-hidden rounded-xl border border-[#D9DAD4] bg-[#E4E5E2]"
      aria-label="Prévia do Monitoramento"
    >
      <PlatformMap
        section="monitoring"
        showMonitoringControls={section === "monitoring"}
      />
      <div className="absolute inset-y-0 left-0 z-20 w-[420px] overflow-hidden border-r border-neutral-200 bg-[#F6F7F6]">
        {section === "analysis-detail" ? (
          <AnalysisContext
            activeSection={section}
            panelLayers={[panelLayer]}
            onRequestSectionChange={setSection}
          />
        ) : (
          <ModulesContext
            activeSection="monitoring"
            panelLayers={[panelLayer]}
            onRequestSectionChange={setSection}
          />
        )}
      </div>
      <div className="pointer-events-none absolute left-[436px] top-4 z-30 rounded-full bg-stone-950/80 px-4 py-2 text-xs font-semibold text-white shadow">
        PRÉVIA ADMINISTRATIVA — NÃO PUBLICADA
      </div>
    </section>
  );
}
