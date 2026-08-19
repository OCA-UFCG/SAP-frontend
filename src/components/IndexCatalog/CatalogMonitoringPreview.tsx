"use client";

import { useEffect, useMemo, useState } from "react";
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

export function CatalogMonitoringPreview({
  preview,
}: {
  preview: IndexCatalogPreview;
}) {
  const [section, setSection] = useState<PlatformSection>("monitoring");
  const { activateEeLayer, resetPlatformState, setActiveYear } =
    useMapLayerActions();
  const panelLayer = useMemo(
    () => preview.panelLayer as PanelLayerI,
    [preview],
  );

  useEffect(() => {
    resetPlatformState();
    const years = getImageDataYearKeys(panelLayer.imageData);
    const initialYear =
      (isCompactImageData(panelLayer.imageData)
        ? panelLayer.imageData.defaultYear
        : undefined) ??
      years.at(-1) ??
      "";

    if (initialYear) {
      setActiveYear(initialYear);
    }
    activateEeLayer(
      panelLayer as unknown as IEEInfo,
      getImageDataLegend(panelLayer.imageData),
    );

    return resetPlatformState;
  }, [activateEeLayer, panelLayer, resetPlatformState, setActiveYear]);

  return (
    <section
      className="relative h-[720px] min-h-[620px] overflow-hidden rounded-xl border border-[#D9DAD4] bg-[#E4E5E2]"
      aria-label="Prévia do Monitoramento"
    >
      <PlatformMap showMonitoringOverlays={section === "monitoring"} />
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
