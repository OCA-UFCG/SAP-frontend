"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { EeMapUrlFailure } from "@/contracts/eeMapUrls";
import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";
import type { IndexCatalogReportPreview } from "@/types/indexCatalog";
import { MunicipalReportDynamicChart } from "@/components/MunicipalReport/MunicipalReportDynamicChart";
import { ReportMapPreview } from "@/components/MunicipalReport/ReportMapPreview";
import { destroyReportMapPool } from "@/components/MunicipalReport/reportMapPool";
import { fetchMapURL } from "@/services/mapServices";
import {
  compactPeriodRange,
  formatReportPeriod,
} from "@/utils/municipalReportNarrative";
import { getMunicipalReportValueLabels } from "@/utils/municipalReportValue";
import { resolveReportTerritory } from "@/utils/reportTerritory";

/** A prévia é uma tela administrativa em pt-BR; o relatório real é traduzido. */
const PREVIEW_LOCALE = "pt-BR";

/** Campina Grande — PB, o município de exemplo da prévia do catálogo. */
const FALLBACK_PREVIEW_MUNICIPALITY_CODE = "2504009";

interface DraftTileUrl {
  key: string;
  url?: string;
  failure?: EeMapUrlFailure;
}

/**
 * A URL de tiles do rascunho para um período.
 *
 * O relatório de produção resolve as suas em lote (`/api/ee/map-urls`), porque
 * tem até vinte camadas; a prévia tem uma só e pede direto à rota do rascunho.
 */
function useDraftTileUrl(
  tileApiPath: string,
  panelLayerId: string,
  period: string,
) {
  const [tileUrl, setTileUrl] = useState<DraftTileUrl | null>(null);
  const key = `${panelLayerId}:${period}`;

  useEffect(() => {
    const controller = new AbortController();
    fetchMapURL(
      panelLayerId,
      period,
      controller.signal,
      undefined,
      undefined,
      tileApiPath,
    )
      .then((url) =>
        setTileUrl(url ? { key, url } : { key, failure: "year_not_found" }),
      )
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") {
          return;
        }
        setTileUrl({ key, failure: "error" });
      });
    return () => controller.abort();
  }, [key, panelLayerId, period, tileApiPath]);

  return tileUrl?.key === key ? tileUrl : null;
}

/**
 * A imagem espacial do município e a série histórica, lado a lado como no
 * Relatório Automático.
 */
export function ReportPreviewVisuals({
  analysis,
  municipality,
  referencePeriod,
  tileApiPath,
  translateLabel,
}: {
  analysis: MunicipalReportAnalysis;
  municipality: IndexCatalogReportPreview["municipality"];
  referencePeriod: string;
  tileApiPath: string;
  translateLabel: (label: string) => string;
}) {
  const t = useTranslations("MunicipalReport");
  // A prévia do catálogo é sempre municipal: ela mostra como o índice ficará no
  // relatório de um município de exemplo.
  const previewTerritory =
    resolveReportTerritory(municipality.code) ??
    resolveReportTerritory(FALLBACK_PREVIEW_MUNICIPALITY_CODE)!;
  const tileUrl = useDraftTileUrl(tileApiPath, analysis.id, referencePeriod);
  // O mapa volta para a estante do relatório ao sair de cena; sem esvaziá-la o
  // contexto WebGL sobreviveria ao fechamento da prévia.
  useEffect(() => destroyReportMapPool, []);
  const referencePeriodLabel = formatReportPeriod(
    referencePeriod,
    PREVIEW_LOCALE,
  );
  const valueLabels = getMunicipalReportValueLabels(analysis);
  const historyRange = compactPeriodRange(
    analysis.timeSeries,
    referencePeriod,
    PREVIEW_LOCALE,
  );

  return (
    <div className="m-5">
      <h3 className="text-lg font-bold text-[#536e7b]">
        {t("spatialAndTimeSeries")}
      </h3>
      <div className="mt-3 grid overflow-hidden border border-[#c8ced1] bg-[#fbfcfd] md:grid-cols-2">
        <div className="flex flex-col border-b border-[#c8ced1] md:border-b-0 md:border-r">
          <div className="border-b border-[#c8ced1] bg-[#f8fafb] px-4 py-2.5 text-center text-sm font-semibold text-[#536e7b]">
            {t("spatialImage", {
              period: analysis.snapshot?.label || referencePeriodLabel,
            })}
          </div>
          <ReportMapPreview
            territory={previewTerritory}
            layerId={analysis.id}
            period={referencePeriod}
            className="h-[230px] w-full"
            tileUrl={tileUrl?.url}
            unavailableReason={tileUrl?.failure}
          />
          <p className="border-t border-[#c8ced1] px-4 py-2 text-xs leading-5 text-neutral-600">
            {t("rasterDescription", {
              title: analysis.title,
              period: referencePeriodLabel,
              territory: previewTerritory.label,
              scope: previewTerritory.kindLabel,
              boundary: previewTerritory.possessiveLabel,
            })}
          </p>
        </div>
        <div className="flex flex-col">
          <div className="border-b border-[#c8ced1] bg-[#f8fafb] px-4 py-2.5 text-center text-sm font-semibold text-[#536e7b]">
            {valueLabels.chartSeries}: {historyRange}
          </div>
          <div className="flex min-h-[260px] flex-1 items-center justify-center bg-[#fbfcfd] p-3">
            <MunicipalReportDynamicChart
              analysis={analysis}
              locale={PREVIEW_LOCALE}
              referencePeriod={referencePeriod}
              translateLabel={translateLabel}
            />
          </div>
          <p className="border-t border-[#c8ced1] px-4 py-2 text-xs leading-5 text-neutral-600">
            {t("analyzedPeriod")}: {referencePeriodLabel}.
          </p>
        </div>
      </div>
    </div>
  );
}
