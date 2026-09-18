"use client";

import {
  useCallback,
  useEffect,
  memo,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type {
  MunicipalReportAnalysis,
  MunicipalReportData,
  MunicipalReportDocsContent,
} from "@/contracts/municipalReport";
import { getMunicipalReportPresentation } from "@/config/municipalReport";
import {
  buildAnalysisNarrativeSections,
  buildSituationNarrative,
  compactPeriodRange,
  formatReportPeriod,
  getReportDocsText,
} from "@/utils/municipalReportNarrative";
import {
  finishMunicipalReportMetrics,
  recordMunicipalReportNavigation,
  startMunicipalReportStage,
} from "@/utils/municipalReportMetrics";
import {
  formatMunicipalReportValue,
  getMunicipalReportValueLabels,
} from "@/utils/municipalReportValue";
import {
  translateAnalysisTitle,
  translateClassLabel,
} from "@/utils/municipalReportTranslations";
import {
  getReportCategoryTokens,
  reportAnalysisAnchorId,
} from "@/utils/municipalReportCategories";
import { isStackableAnalysis } from "@/utils/municipalReportStackedChart";
import { MunicipalReportClassBars } from "./MunicipalReportClassBars";
import { MunicipalReportNotes } from "./MunicipalReportNotes";
import { MunicipalReportStackedChart } from "./MunicipalReportStackedChart";
import { MunicipalReportStackedPrintChart } from "./MunicipalReportStackedPrintChart";
import { ReportBackToTop } from "./ReportBackToTop";
import { ReportDocumentFooter } from "./ReportDocumentFooter";
import { ReportHero } from "./ReportHero";
import { ReportSectionHeading } from "./ReportSectionHeading";
import { ReportVariableIndex } from "./ReportVariableIndex";
import { ReportMapPreview } from "./ReportMapPreview";
import { destroyReportMapPool } from "./reportMapPool";
import { useReportMapCaptureQueue } from "./useReportMapCaptureQueue";
import {
  useReportMapTileUrls,
  type ReportMapTileUrls,
} from "./useReportMapTileUrls";
import type { EeMapUrlFailure } from "@/contracts/eeMapUrls";

export interface MunicipalReportPreviewProps {
  /** Chave territorial do relatório: código IBGE, UF, "br" ou recorte agregado. */
  locationKey: string;
  period: string;
  layerIds?: string[];
  embedded?: boolean;
  onOpenMonitor?: (layerId: string) => void;
}

function textColorForBackground(color: string) {
  const hex = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
  const [red, green, blue] = [0, 2, 4].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  );
  return red * 0.299 + green * 0.587 + blue * 0.114 > 170
    ? "#202020"
    : "#ffffff";
}

/** Fontes declaradas em `src/app/[locale]/layout.tsx` e usadas pelo documento. */
const FONT_VARIABLE_NAMES = ["--font-open-sans", "--font-inter"];

function buildReportFilename(
  report: MunicipalReportData | null,
  period: string,
  fallback: string,
  prefix: string,
) {
  if (!report) return fallback;
  // O nome, e não o rótulo: o rótulo do município leva "— UF", e um travessão
  // no meio do nome do arquivo não ajuda ninguém.
  const territory = report.territory.name.trim().replace(/\s+/g, "-");
  return `${prefix}-${territory}-${period}.pdf`;
}

const AnalysisSection = memo(function AnalysisSection({
  analysis,
  report,
  locale,
  mapKey,
  mapSrc,
  mapActive,
  mapAttempt,
  mapQueuedAt,
  onMapVisibility,
  mapTileUrl,
  mapUnavailableReason,
  onMapCapture,
  docsContent,
  monitorHref,
  onOpenMonitor,
}: {
  analysis: MunicipalReportAnalysis;
  report: MunicipalReportData;
  locale: string;
  mapKey: string;
  monitorHref: string;
  mapSrc?: string;
  mapActive?: boolean;
  mapAttempt?: number;
  mapQueuedAt?: number | null;
  onMapVisibility?: (key: string, visible: boolean) => void;
  mapTileUrl?: string;
  mapUnavailableReason?: EeMapUrlFailure;
  onMapCapture?: (key: string, src: string | null) => void;
  docsContent: MunicipalReportDocsContent | null;
  onOpenMonitor?: (layerId: string) => void;
}) {
  const t = useTranslations("MunicipalReport");
  const tModules = useTranslations("ModulesContext");
  const tCaption = useTranslations("PlatformMapCaption");
  const tHas = (key: string) => t.has(key);
  const tModulesHas = (key: string) => tModules.has(key);
  const tCaptionHas = (key: string) => tCaption.has(key);

  const translatedTitle = translateAnalysisTitle(
    analysis,
    t,
    tHas,
    tModules,
    tModulesHas,
  );
  const translateLabel = (label: string) =>
    translateClassLabel(label, t, tHas, tCaption, tCaptionHas);
  const dominant = analysis.snapshot?.dominantClass;
  const presentation = getMunicipalReportPresentation(analysis.id);
  const situationText = buildSituationNarrative(
    analysis,
    docsContent,
    report,
    presentation,
    locale,
    (key, values) => t(key, values),
    translateLabel,
    (title, id) =>
      translateAnalysisTitle(
        { ...analysis, title, id },
        t,
        tHas,
        tModules,
        tModulesHas,
      ),
    tHas,
  );
  const accent = getReportCategoryTokens(analysis.category).accent;
  const effectivePeriod = analysis.effectivePeriod ?? analysis.snapshot?.period;
  const referencePeriod =
    effectivePeriod ?? analysis.snapshot?.period ?? analysis.requestedPeriod;
  const referencePeriodLabel = formatReportPeriod(referencePeriod, locale);
  const snapshotPeriodLabel = analysis.snapshot?.label || referencePeriodLabel;
  const periodResolution = `${t("analyzedPeriod")}: ${referencePeriodLabel}.`;
  const historyRange = compactPeriodRange(
    analysis.timeSeries,
    referencePeriod,
    locale,
    (key, values) => t(key, values),
  );
  const narrativeSections = buildAnalysisNarrativeSections(
    analysis,
    docsContent,
    locale,
  );
  const valueLabels = getMunicipalReportValueLabels(analysis, (key, values) =>
    t(key, values),
  );

  return (
    <section
      id={reportAnalysisAnchorId(analysis.alias)}
      className="report-section scroll-mt-16"
    >
      <div
        className="report-analysis-header report-block flex flex-wrap items-center justify-between gap-4 rounded-r-lg border-l-[3px] bg-[#F8F7F8] px-4 py-2"
        style={{ borderLeftColor: accent }}
      >
        <div className="min-w-0">
          <h2 className="font-open-sans text-[18px] font-bold leading-[1.5] tracking-[-0.216px] text-[#292829]">
            {translatedTitle}
          </h2>
          <p className="font-open-sans flex flex-wrap gap-1 text-xs leading-5 text-[#292829]">
            <strong className="font-semibold">{t("availableSeries")}:</strong>
            {historyRange}
          </p>
        </div>
        <Link
          href={monitorHref}
          onClick={(event) => {
            // Dentro da plataforma a troca é estado de cliente: instantânea, e
            // sem descartar o CSS do chunk do relatório como a navegação fazia.
            // O `href` continua servindo o clique do meio, o "abrir em nova
            // aba" e a página autônoma.
            if (!onOpenMonitor || event.metaKey || event.ctrlKey) return;
            event.preventDefault();
            onOpenMonitor(analysis.id);
          }}
          className="font-open-sans shrink-0 rounded-md bg-[#989F43] px-4 py-2 text-sm leading-6 text-white transition hover:bg-[#868D3B] print:hidden"
        >
          {t("document.viewMonitor")}
        </Link>
      </div>

      {analysis.status !== "available" || !analysis.snapshot ? (
        <div className="report-analysis-summary report-block mt-6 border border-[#d9e0e3] p-5">
          <p className="font-bold text-[#536e7b]">
            {t(`status.${analysis.status}`)}
          </p>
          {analysis.timeSeries.length > 0 && (
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              {t("availablePeriods")}:{" "}
              {analysis.timeSeries.map((item) => item.period).join(", ")}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="report-situation mt-7">
            <ReportSectionHeading level={3} accent={accent}>
              {t("document.situationTitle")}
            </ReportSectionHeading>
            <div className="mt-4 grid gap-6 md:grid-cols-[1fr_320px]">
              {situationText && (
                <p className="whitespace-pre-line text-[15px] leading-7 text-[#2C3A31]">
                  {situationText}
                </p>
              )}
              {dominant && (
                <div className="report-block flex items-stretch overflow-hidden rounded-lg border border-[#E4EBE5] bg-white">
                  <div className="flex flex-1 flex-col justify-center px-4 py-3">
                    <strong className="text-base text-[#2C3A31]">
                      {translateLabel(dominant.label)}
                    </strong>
                    <span className="mt-0.5 text-xs text-[#58655C]">
                      {t("analyzedPeriod")}: {referencePeriodLabel}
                    </span>
                  </div>
                  <div
                    className="flex w-[150px] shrink-0 items-center justify-center px-3 text-center text-lg font-bold"
                    style={{
                      backgroundColor: dominant.color || accent,
                      color: textColorForBackground(dominant.color || accent),
                    }}
                  >
                    {formatMunicipalReportValue(
                      dominant.percentage,
                      analysis,
                      locale,
                    )}{" "}
                    {valueLabels.cardContext}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="report-class-coverage mt-8">
            <ReportSectionHeading level={3} accent={accent}>
              {t("document.classCoverageTitle")}
            </ReportSectionHeading>
            <div className="report-block mt-4 flex flex-col gap-2 overflow-hidden rounded-lg border border-[#EFEFEF] bg-[#F6F7F6] p-4">
              <MunicipalReportClassBars
                analysis={analysis}
                locale={locale}
                translateLabel={translateLabel}
              />
            </div>
          </div>

          <div className="report-spatial mt-8">
            <ReportSectionHeading level={3} accent={accent}>
              {t("document.spatialDistributionTitle")}
            </ReportSectionHeading>
            <div className="report-block mt-4 flex flex-col gap-4 overflow-hidden rounded-lg border border-[#EFEFEF] bg-[#F6F7F6] p-4">
              <p className="font-open-sans text-base font-bold text-[#292829]">
                {t("spatialImage", { period: snapshotPeriodLabel })}
              </p>
              <ReportMapPreview
                territory={report.territory}
                layerId={analysis.id}
                period={referencePeriod}
                className="report-map-frame aspect-[696/322] w-full rounded-lg bg-white"
                active={mapActive}
                attempt={mapAttempt}
                imageSrc={mapSrc}
                queuedAt={mapQueuedAt}
                tileUrl={mapTileUrl}
                unavailableReason={mapUnavailableReason}
                onCapture={(src) => onMapCapture?.(mapKey, src)}
                onVisibilityChange={(visible) =>
                  onMapVisibility?.(mapKey, visible)
                }
              />
              <p className="font-open-sans text-xs leading-5 text-[#292829]">
                {t("rasterDescription", {
                  title: translatedTitle,
                  period: referencePeriodLabel,
                  territory: report.territory.label,
                  scope: report.territory.kindLabel,
                  // O pt-BR usa a forma com preposição ("do bioma Caatinga");
                  // as outras línguas montam a frase com {territory}.
                  boundary: report.territory.possessiveLabel,
                })}
              </p>
            </div>
          </div>

          {isStackableAnalysis(analysis) && analysis.timeSeries.length > 0 && (
            <div className="report-time-series mt-8">
              <ReportSectionHeading level={3} accent={accent}>
                {t("document.timeSeriesTitle")}
              </ReportSectionHeading>
              <div className="report-block mt-4 flex flex-col gap-4 overflow-hidden rounded-lg border border-[#EFEFEF] bg-[#F6F7F6] p-4">
                <p className="font-open-sans text-base font-bold text-[#292829]">
                  {historyRange}
                </p>
                <div className="report-chart-screen">
                  <MunicipalReportStackedChart
                    analysis={analysis}
                    locale={locale}
                    referencePeriod={referencePeriod}
                    translateLabel={translateLabel}
                  />
                </div>
                <div className="report-chart-print hidden">
                  <MunicipalReportStackedPrintChart
                    analysis={analysis}
                    referencePeriod={referencePeriod}
                    translateLabel={translateLabel}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="report-narrative mt-8">
            <ReportSectionHeading level={3} accent={accent}>
              {t("document.timeSeriesAnalysisTitle")}
            </ReportSectionHeading>
            <div className="mt-4 text-[15px] leading-7">
              {narrativeSections.length > 0 ? (
                narrativeSections.map((section, sectionIndex) => (
                  <p
                    key={`${section.title}:${sectionIndex}`}
                    className="mt-3 whitespace-pre-line text-[#2C3A31] first:mt-0"
                  >
                    <strong className="block text-sm font-semibold text-[#2C3A31]">
                      {section.title}
                    </strong>
                    {section.text}
                  </p>
                ))
              ) : (
                <p className="text-[#2C3A31]">
                  {t("historicalNoteText", {
                    count: String(analysis.timeSeries.length),
                    range: historyRange,
                    resolution: periodResolution,
                  })}
                </p>
              )}
              <p className="mt-3 text-[#2C3A31]">
                <strong className="block text-sm font-semibold text-[#2C3A31]">
                  {t("sectionReferenceLabel")}
                </strong>
                {periodResolution}
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
});

const ReportDocument = memo(function ReportDocument({
  report,
  layerIds = [],
  mapImages,
  activeMapKeys,
  mapQueueStartedAt,
  mapTileUrls,
  retryAttemptFor,
  onMapCapture,
  onMapVisibility,
  documentRef,
  docsContent,
  onDownload,
  downloadDisabled,
  downloadLabel,
  onOpenMonitor,
}: {
  report: MunicipalReportData;
  layerIds?: string[];
  mapImages: Map<string, string | null>;
  activeMapKeys: ReadonlySet<string>;
  mapQueueStartedAt: number | null;
  mapTileUrls: ReportMapTileUrls;
  retryAttemptFor: (key: string) => number;
  onMapCapture?: (key: string, src: string | null) => void;
  onMapVisibility?: (key: string, visible: boolean) => void;
  documentRef?: Ref<HTMLElement>;
  docsContent: MunicipalReportDocsContent | null;
  onDownload?: () => void;
  downloadDisabled?: boolean;
  downloadLabel?: string;
  onOpenMonitor?: (layerId: string) => void;
}) {
  const t = useTranslations("MunicipalReport");
  const tModules = useTranslations("ModulesContext");
  const tHas = (key: string) => t.has(key);
  const tModulesHas = (key: string) => tModules.has(key);
  const locale = useLocale();
  const generatedAt = new Date(report.generatedAt).toLocaleDateString(locale);
  const selected = layerIds.length
    ? report.analyses.filter(({ id }) => layerIds.includes(id))
    : report.analyses;

  /**
   * O link "Ver monitor" de uma seção.
   *
   * `?layer=` chega ao `ModulesContext`, que ativa a camada no mapa e abre o
   * detalhamento dela — o mesmo caminho de quem clica no índice pelo painel.
   *
   * O pedido do relatório viaja junto porque este link é uma navegação, e é a
   * URL que guarda o relatório: trocar de seção pelo trilho lateral é estado de
   * cliente e a preserva, mas sair daqui sem ela faria a aba Comunicação voltar
   * vazia quando o leitor retornasse.
   */
  function buildMonitorHref(analysisId: string) {
    const params = new URLSearchParams({
      section: "monitoring",
      layer: analysisId,
      locationKey: report.territory.locationKey,
      period: report.requestedPeriod,
    });
    const selectedIds = selected.map(({ id }) => id);
    if (selectedIds.length) params.set("layers", selectedIds.join(","));

    return `/${locale}/platform?${params.toString()}`;
  }
  // O documento do Google Docs continua podendo sobrescrever os textos de
  // moldura, como fazia no cabeçalho antigo.
  const reportText = (section: string, fallback: string) =>
    getReportDocsText(docsContent, section, locale) ?? fallback;

  return (
    <article
      ref={documentRef}
      className="report-paper report-paper-html min-h-full bg-white text-[#202020]"
    >
      <ReportHero
        report={report}
        period={formatReportPeriod(report.requestedPeriod, locale)}
        onDownload={onDownload}
        downloadDisabled={downloadDisabled}
        downloadLabel={downloadLabel}
        title={reportText("Título principal", t("document.mainTitle"))}
        subtitle={reportText("Subtítulo", t("document.subtitle"))}
      />
      <ReportBackToTop />

      <div className="flex flex-col gap-6 px-10 py-6">
        <ReportSectionHeading level={2} accent="#989F43">
          {t("document.variableIndexTitle")}
        </ReportSectionHeading>
        <div>
          <ReportVariableIndex
            analyses={selected}
            translateTitle={(analysis) =>
              translateAnalysisTitle(analysis, t, tHas, tModules, tModulesHas)
            }
          />
        </div>

        <div className="report-sections space-y-12">
          {selected.map((analysis) => {
            const mapKey = `${analysis.id}:${analysis.effectivePeriod ?? analysis.snapshot?.period ?? report.requestedPeriod}`;
            return (
              <AnalysisSection
                key={analysis.id}
                analysis={analysis}
                report={report}
                locale={locale}
                mapKey={mapKey}
                mapSrc={mapImages.get(mapKey) ?? undefined}
                mapActive={activeMapKeys.has(mapKey)}
                mapAttempt={retryAttemptFor(mapKey)}
                mapQueuedAt={mapQueueStartedAt}
                mapTileUrl={mapTileUrls.tileUrlFor(mapKey)}
                mapUnavailableReason={mapTileUrls.failureFor(mapKey)}
                onMapCapture={onMapCapture}
                onMapVisibility={onMapVisibility}
                docsContent={docsContent}
                monitorHref={buildMonitorHref(analysis.id)}
                onOpenMonitor={onOpenMonitor}
              />
            );
          })}
        </div>

        <MunicipalReportNotes
          analyses={selected}
          docsContent={docsContent}
          locale={locale}
        />

        <ReportDocumentFooter
          generatedAt={generatedAt}
          text={getReportDocsText(docsContent, "Rodapé", locale) ?? undefined}
        />
      </div>
    </article>
  );
});

function EmptyReportPreview() {
  const t = useTranslations("MunicipalReport");

  return (
    <div className="flex h-full min-h-[620px] flex-col items-center justify-center gap-6 px-8 py-12 text-center">
      <svg
        className="h-auto w-full max-w-[488px]"
        viewBox="0 0 488 488"
        fill="none"
        aria-hidden="true"
      >
        <use href="/sprite.svg#municipal-report-empty-illustration" />
      </svg>
      <div className="flex w-full max-w-[602px] items-center justify-center rounded-2xl bg-[#E1E2B4] p-9">
        <p className="font-open-sans text-2xl font-bold leading-[1.5] text-[#777E32]">
          {t("emptyPreviewInstruction")}
        </p>
      </div>
    </div>
  );
}

export function MunicipalReportPreview({
  locationKey,
  period,
  layerIds,
  embedded = false,
  onOpenMonitor,
}: MunicipalReportPreviewProps) {
  const t = useTranslations("MunicipalReport");
  const locale = useLocale();
  const hasRequiredParameters = Boolean(locationKey && period);
  const [report, setReport] = useState<MunicipalReportData | null>(null);
  const [docsContent, setDocsContent] =
    useState<MunicipalReportDocsContent | null>(null);
  // Os textos chegam depois do relatório, em paralelo com os mapas. O download
  // espera por eles: um PDF exportado no meio do caminho sairia sem texto.
  const [docsResolved, setDocsResolved] = useState(false);
  const [mapQueueStartedAt, setMapQueueStartedAt] = useState<number | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(hasRequiredParameters);
  const [exporting, setExporting] = useState(false);
  const [zoom, setZoom] = useState(100);
  const reportDocumentRef = useRef<HTMLElement>(null);
  const navigationMeasuredRef = useRef(false);
  const previewMeasuredRef = useRef(false);
  const summaryMeasuredRef = useRef(false);
  const mapQueueMeasuredRef = useRef(false);
  const mapQueuePeakConcurrencyRef = useRef(0);
  const layerIdsKey = useMemo(() => layerIds?.join(",") ?? "", [layerIds]);
  const requestedMapKeys = useMemo(() => {
    if (!report) return [];
    const selectedLayerIds = layerIdsKey
      ? new Set(layerIdsKey.split(","))
      : null;
    return (
      selectedLayerIds
        ? report.analyses.filter(({ id }) => selectedLayerIds.has(id))
        : report.analyses
    )
      .filter(
        (analysis) => analysis.status === "available" && analysis.snapshot,
      )
      .map(
        (analysis) =>
          `${analysis.id}:${analysis.effectivePeriod ?? analysis.snapshot?.period ?? report.requestedPeriod}`,
      );
  }, [layerIdsKey, report]);
  const loadErrorMessage = t("loadError");
  const mapTileUrls = useReportMapTileUrls(requestedMapKeys);
  // A fila de captura recebe cada camada assim que a URL dela chega, e nunca as
  // que não têm imagem no período: montar um MapLibre para uma dessas só
  // gastava contexto WebGL e terminava em captura vazia.
  const reportMapKeys = useMemo(
    () => requestedMapKeys.filter((key) => mapTileUrls.tileUrlFor(key)),
    [mapTileUrls, requestedMapKeys],
  );
  const {
    activeMapKeys,
    handleMapCapture,
    handleMapVisibility,
    mapImages,
    mapsReady: capturesReady,
    pendingMapCount,
    resetMapCaptureQueue,
    retryAttemptFor,
  } = useReportMapCaptureQueue(reportMapKeys);
  // Enquanto as URLs não voltam a fila está vazia, e uma fila vazia estaria
  // "pronta": sem esta guarda o botão de exportar liberava antes do primeiro
  // mapa existir.
  const mapsReady = mapTileUrls.resolved && capturesReady;
  const reportReadyForExport = mapsReady && docsResolved;

  useEffect(() => {
    if (!hasRequiredParameters || navigationMeasuredRef.current) return;
    navigationMeasuredRef.current = true;
    recordMunicipalReportNavigation();
  }, [hasRequiredParameters]);

  // Cinco contextos WebGL guardados são baratos enquanto o relatório está
  // aberto, e desperdício depois que ele sai da tela.
  useEffect(() => destroyReportMapPool, []);

  useEffect(() => {
    if (!report || loading || previewMeasuredRef.current) return;
    previewMeasuredRef.current = true;
    const finishRender = startMunicipalReportStage();
    const frame = window.requestAnimationFrame(() => {
      finishRender("Renderização da prévia", {
        detalhes: `${report.analyses.length} análise(s) no documento`,
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, report]);

  useEffect(() => {
    mapQueueMeasuredRef.current = false;
    mapQueuePeakConcurrencyRef.current = 0;
  }, [mapQueueStartedAt]);

  useEffect(() => {
    mapQueuePeakConcurrencyRef.current = Math.max(
      mapQueuePeakConcurrencyRef.current,
      activeMapKeys.size,
    );
  }, [activeMapKeys, mapQueueStartedAt]);

  useEffect(() => {
    if (
      !report ||
      loading ||
      !mapsReady ||
      mapQueueStartedAt === null ||
      mapQueueMeasuredRef.current
    )
      return;
    mapQueueMeasuredRef.current = true;
    const finishQueue = startMunicipalReportStage(mapQueueStartedAt);
    finishQueue("Fila de imagens espaciais", {
      detalhes: `${reportMapKeys.length} mapa(s); concorrência máxima ${mapQueuePeakConcurrencyRef.current}`,
    });
  }, [loading, mapQueueStartedAt, mapsReady, report, reportMapKeys.length]);

  useEffect(() => {
    if (!report || loading || !mapsReady || summaryMeasuredRef.current) return;
    summaryMeasuredRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      finishMunicipalReportMetrics(
        `${reportMapKeys.length} mapa(s) capturado(s); visualização HTML pronta.`,
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, mapsReady, report, reportMapKeys.length]);

  // `printReport` é redeclarado a cada render, e passá-lo direto ao
  // `ReportDocument` quebraria o `memo` dele — o zoom voltaria a remontar os
  // vinte mapas. Esta referência é estável e sempre chama a versão atual.
  const printReportRef = useRef<() => void>(() => {});
  const handleDownload = useCallback(() => printReportRef.current(), []);

  function printReport() {
    if (!reportDocumentRef.current || exporting || !reportReadyForExport)
      return;

    setExporting(true);
    setError(null);
    const printWindow = window.open("", "_blank", "popup,width=980,height=800");
    if (!printWindow) {
      setExporting(false);
      setError(t("popupBlocked"));
      return;
    }

    const styles = [
      ...document.querySelectorAll('link[rel="stylesheet"], style'),
    ]
      .map((element) => element.outerHTML)
      .join("\n");
    const baseUrl = `${window.location.origin}/`;
    // As variáveis de fonte do next/font vivem na className do <body> do app
    // (src/app/[locale]/layout.tsx). A janela de impressão monta um <body> novo,
    // sem essa classe, e o PDF saía numa fonte de sistema em vez de Open Sans —
    // o que muda a largura do texto e a quebra de página junto. Vão como regra
    // CSS, e não como atributo style: o valor resolvido traz aspas duplas
    // (`"Open Sans", "Open Sans Fallback"`) que truncariam o atributo.
    const appBodyStyle = getComputedStyle(document.body);
    const printFontVariables = FONT_VARIABLE_NAMES.map(
      (name) => `${name}:${appBodyStyle.getPropertyValue(name)}`,
    ).join(";");
    const filename = buildReportFilename(
      report,
      period,
      t("reportLabel"),
      t("reportFilenamePrefix"),
    );
    const printOverrides = `
      <style>
        @page{size:A4;margin:12mm 14mm}
        body{${printFontVariables}}
        html,body{width:auto;margin:0;background:#fff}
        body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .report-paper{box-sizing:border-box;width:auto!important;min-height:auto!important;margin:0!important;padding:0!important;overflow:visible;box-shadow:none!important}
        .report-paper>div{padding:0!important}
        .report-hero>div{padding-left:0!important;padding-right:0!important}
        .report-back-to-top{display:none!important}
        @media print{
          .report-chart-screen{display:none!important}
          .report-chart-print{display:block!important}
          .report-print-chart-svg{display:block;width:100%!important;height:auto!important;overflow:visible!important}
          .report-map-frame{aspect-ratio:auto!important;height:70mm!important}
          .report-map-frame img{width:100%;height:100%;object-fit:contain!important;object-position:center!important}
          .report-sections{margin-top:8mm!important}
          .report-section+.report-section{margin-top:10mm!important}
          .report-section{break-inside:auto;page-break-inside:auto}
          .report-analysis-header{break-after:avoid;page-break-after:avoid}
          .report-heading{break-after:avoid;page-break-after:avoid}
          .report-block{break-inside:avoid;page-break-inside:avoid}
          .report-class-bar-row{break-inside:avoid;page-break-inside:avoid}
          .report-variable-index{break-inside:avoid;page-break-inside:avoid}
          /* Mapa, gráfico e barras de classe medem 435, 506 e até 530px numa
             página A4 de 1032px úteis: dois cabem, três nunca. Enquanto o cartão
             inteiro era indivisível, o terceiro pulava de página e deixava um
             vão de 300 a 500px no pé da anterior, seção após seção. O que de
             fato não pode ser cortado ao meio é a imagem do mapa e o SVG do
             gráfico; o cabeçalho, a legenda e a tabela de classes podem fluir. */
          .report-time-series,.report-spatial,.report-class-coverage{break-inside:auto;page-break-inside:auto}
          .report-time-series>.report-block,.report-spatial>.report-block,.report-class-coverage>.report-block{break-inside:auto;page-break-inside:auto}
          .report-map-frame,.report-chart-print{break-inside:avoid;page-break-inside:avoid}
          .report-narrative{break-inside:auto;page-break-inside:auto}
          .report-notes{break-inside:auto;page-break-inside:auto;margin-top:8mm!important;padding-top:5mm!important}
          .report-document-footer{break-inside:avoid;page-break-inside:avoid}
          .report-paper p,.report-notes p{orphans:3;widows:3}
        }
      </style>`;

    printWindow.document.open();
    printWindow.document.write(
      `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><base href="${baseUrl}"><title></title>${styles}${printOverrides}</head><body>${reportDocumentRef.current.outerHTML}</body></html>`,
    );
    printWindow.document.close();
    printWindow.document.title = filename;

    const finish = () => {
      printWindow.focus();
      printWindow.print();
      setExporting(false);
    };
    printWindow.addEventListener("afterprint", () => printWindow.close(), {
      once: true,
    });
    if (printWindow.document.readyState === "complete") {
      window.setTimeout(finish, 300);
    } else {
      printWindow.addEventListener(
        "load",
        () => window.setTimeout(finish, 300),
        { once: true },
      );
    }
  }

  // Fora do render: o React Compiler não permite escrever em ref durante ele, e
  // o clique no botão só acontece depois que os efeitos rodaram.
  useEffect(() => {
    printReportRef.current = printReport;
  });

  useEffect(() => {
    if (!hasRequiredParameters) return;
    const controller = new AbortController();

    async function loadReport() {
      let reportLoaded = false;
      previewMeasuredRef.current = false;
      summaryMeasuredRef.current = false;
      resetMapCaptureQueue();
      setMapQueueStartedAt(null);
      setDocsResolved(false);
      setLoading(true);
      setError(null);
      try {
        const finishBaseReport = startMunicipalReportStage();
        const reportParams = new URLSearchParams({ period });
        if (layerIdsKey) reportParams.set("layers", layerIdsKey);
        const response = await fetch(
          `/api/municipal-report/${encodeURIComponent(locationKey)}?${reportParams.toString()}`,
          { credentials: "same-origin", signal: controller.signal },
        );
        const payload = await response.json();
        finishBaseReport("Relatório-base", {
          response,
          detalhes: `${layerIdsKey ? layerIdsKey.split(",").length : "todas"} camada(s) solicitada(s)`,
        });
        if (!response.ok) throw new Error(payload.error ?? loadErrorMessage);
        reportLoaded = true;
        setReport(payload as MunicipalReportData);
        setDocsContent(null);

        const reportData = payload as MunicipalReportData;
        const hasAvailableAnalysis = reportData.analyses.some(
          (analysis) => analysis.status === "available",
        );

        const docsTask = async () => {
          if (!hasAvailableAnalysis) {
            setDocsResolved(true);
            return;
          }
          const finishDocs = startMunicipalReportStage();
          let docsResponse: Response | undefined;
          try {
            // As mesmas camadas pedidas no relatório-base: a chave do cache do
            // relatório inclui a lista pedida, então mandar aqui só as
            // disponíveis fazia esta chamada errar o cache e remontar o
            // relatório inteiro. Quem filtra o que vira seção é o servidor.
            const docsParams = new URLSearchParams({ period });
            if (layerIdsKey) docsParams.set("layers", layerIdsKey);
            docsResponse = await fetch(
              `/api/municipal-report/${encodeURIComponent(locationKey)}/docs?${docsParams.toString()}`,
              { credentials: "same-origin", signal: controller.signal },
            );
            const docsPayload = await docsResponse.json();
            finishDocs("Textos do Google Docs", {
              response: docsResponse,
              detalhes: `${layerIdsKey ? layerIdsKey.split(",").length : "todas"} camada(s) solicitada(s)`,
            });
            if (!docsResponse.ok)
              throw new Error(docsPayload.error ?? loadErrorMessage);
            setDocsContent(docsPayload.content as MunicipalReportDocsContent);
          } catch (docsError) {
            if (!docsResponse) {
              finishDocs("Textos do Google Docs", {
                detalhes: "Falha antes de receber a resposta",
              });
            }
            if (controller.signal.aborted) return;
            console.warn(
              "Não foi possível carregar os textos do relatório; mantendo os dados e gráficos disponíveis.",
              docsError,
            );
            setDocsContent(null);
          } finally {
            if (!controller.signal.aborted) setDocsResolved(true);
          }
        };

        // Os textos não entram no caminho crítico: a captura dos mapas só
        // começa quando `loading` vira falso, e esperar o Google Docs aqui
        // somava a latência dele (1,3 s quente, mais no primeiro acesso) antes
        // do primeiro mapa sair. O download continua bloqueado até os textos
        // resolverem, então nenhum PDF sai sem eles.
        void docsTask();
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError")
          return;
        setError(reason instanceof Error ? reason.message : loadErrorMessage);
      } finally {
        if (!controller.signal.aborted) {
          if (reportLoaded) setMapQueueStartedAt(performance.now());
          setLoading(false);
        }
      }
    }

    loadReport();
    return () => controller.abort();
  }, [
    hasRequiredParameters,
    layerIdsKey,
    loadErrorMessage,
    locationKey,
    period,
    resetMapCaptureQueue,
  ]);

  const visibleError = hasRequiredParameters ? error : null;

  if (embedded) {
    const previewTitle = report
      ? `${t("reportLabel")} - ${report.territory.label} - ${formatReportPeriod(period, locale)}`
      : t("reportLabel");

    return (
      <div className="flex h-full min-w-0 flex-col bg-white">
        <div className="shrink-0 border-b border-[#D9E0E3] bg-white px-4 py-4 sm:px-6">
          <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="font-inter text-xs font-semibold uppercase tracking-[0.08em] text-[#536E7B]">
                {t("preview")}
              </p>
              <h1 className="mt-1 truncate font-inter text-base font-semibold text-[#292829]">
                {previewTitle}
              </h1>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoom((value) => Math.max(50, value - 10))}
                  disabled={!report || zoom <= 50}
                  className="flex h-10 w-10 items-center justify-center rounded border border-[#D9E0E3] bg-white text-[#989F43] transition hover:bg-[#F6F7F6] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={t("zoomOut")}
                >
                  <svg
                    className="h-6 w-6"
                    aria-hidden
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="M8 11h6M20 20l-3.5-3.5" />
                  </svg>
                </button>
                <output
                  className="flex h-10 w-[60px] items-center justify-center rounded-md border border-[#DCDBDC] bg-white px-2 font-inter text-sm text-[#7E797B]"
                  aria-live="polite"
                >
                  {zoom}%
                </output>
                <button
                  type="button"
                  onClick={() => setZoom((value) => Math.min(150, value + 10))}
                  disabled={!report || zoom >= 150}
                  className="flex h-10 w-10 items-center justify-center rounded border border-[#D9E0E3] bg-white text-[#989F43] transition hover:bg-[#F6F7F6] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={t("zoomIn")}
                >
                  <svg
                    className="h-6 w-6"
                    aria-hidden
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="M11 8v6M8 11h6M20 20l-3.5-3.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-white">
          {!hasRequiredParameters && <EmptyReportPreview />}
          {loading && (
            <div className="mx-auto flex min-h-56 max-w-[749px] flex-col items-center justify-center gap-4 bg-white p-10 text-center text-neutral-600 shadow-sm">
              <span
                aria-hidden="true"
                className="h-9 w-9 animate-spin rounded-full border-4 border-[#989F43]/25 border-t-[#989F43]"
              />
              <strong className="text-base font-semibold text-[#536e7b]">
                {t("loading")}
              </strong>
              <span className="text-sm">{t("loadingHint")}</span>
            </div>
          )}
          {visibleError && !loading && (
            <div className="mx-auto max-w-[749px] border border-red-200 bg-white p-8 shadow-sm">
              <h1 className="text-xl font-semibold">{t("loadError")}</h1>
              <p className="mt-2 text-sm text-red-700">{visibleError}</p>
            </div>
          )}
          {report && !loading && (
            <div
              className="mx-auto origin-top-left will-change-transform"
              style={{ width: "100%", transform: `scale(${zoom / 100})` }}
            >
              <ReportDocument
                report={report}
                layerIds={layerIds}
                mapImages={mapImages}
                activeMapKeys={activeMapKeys}
                mapQueueStartedAt={mapQueueStartedAt}
                mapTileUrls={mapTileUrls}
                retryAttemptFor={retryAttemptFor}
                onMapCapture={handleMapCapture}
                onMapVisibility={handleMapVisibility}
                documentRef={reportDocumentRef}
                docsContent={docsContent}
                onOpenMonitor={onOpenMonitor}
                onDownload={handleDownload}
                downloadDisabled={exporting || !reportReadyForExport}
                downloadLabel={
                  exporting
                    ? t("preparingDownload")
                    : reportReadyForExport
                      ? t("downloadPdf")
                      : t("preparingDownloadMaps", { count: pendingMapCount })
                }
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#e9ece9] px-4 py-8 sm:px-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-[980px]">
        <Link
          href={`/${locale}/platform?section=communication`}
          className="text-sm font-semibold text-[#526426] hover:underline print:hidden"
        >
          ← {t("back")}
        </Link>
        {loading && (
          <div className="mt-6 bg-white p-10 text-center text-neutral-600 shadow-sm">
            {t("loading")}
          </div>
        )}
        {visibleError && !loading && (
          <div className="mt-6 border border-red-200 bg-white p-8 shadow-sm">
            <h1 className="text-xl font-semibold">{t("loadError")}</h1>
            <p className="mt-2 text-sm text-red-700">{visibleError}</p>
          </div>
        )}
        {report && !loading && (
          <ReportDocument
            report={report}
            layerIds={layerIds}
            mapImages={mapImages}
            activeMapKeys={activeMapKeys}
            mapQueueStartedAt={mapQueueStartedAt}
            mapTileUrls={mapTileUrls}
            retryAttemptFor={retryAttemptFor}
            onMapCapture={handleMapCapture}
            onMapVisibility={handleMapVisibility}
            docsContent={docsContent}
            onOpenMonitor={onOpenMonitor}
            documentRef={reportDocumentRef}
            onDownload={handleDownload}
            downloadDisabled={exporting || !reportReadyForExport}
            downloadLabel={
              exporting
                ? t("preparingDownload")
                : reportReadyForExport
                  ? t("downloadPdf")
                  : t("preparingDownloadMaps", { count: pendingMapCount })
            }
          />
        )}
      </div>
    </div>
  );
}
