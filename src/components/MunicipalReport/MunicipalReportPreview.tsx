"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type {
  MunicipalReportAnalysis,
  MunicipalReportData,
} from "@/contracts/municipalReport";
import { getMunicipalReportPresentation } from "@/config/municipalReport";
import {
  buildHistoryNarrative,
  buildSituationNarrative,
  formatReportPeriod,
} from "@/utils/municipalReportNarrative";
import citiesIndex from "@/data/citiesIndex.json";

interface MunicipalReportPreviewProps {
  municipalityCode: string;
  period: string;
  layerIds?: string[];
  embedded?: boolean;
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

function AnalysisSection({
  analysis,
  report,
  index,
  locale,
  chartSrc,
}: {
  analysis: MunicipalReportAnalysis;
  report: MunicipalReportData;
  index: number;
  locale: string;
  chartSrc?: string;
}) {
  const t = useTranslations("MunicipalReport");
  const dominant = analysis.snapshot?.dominantClass;
  const presentation = getMunicipalReportPresentation(analysis.id);
  const situationText = buildSituationNarrative(analysis, report, presentation, locale);
  const sectionColor = presentation.sectionColor;
  const effectivePeriod = analysis.effectivePeriod ?? analysis.snapshot?.period;
  const historyNarrative = buildHistoryNarrative(
    analysis, report.municipality.name, presentation, locale,
  );

  return (
    <section className="report-section">
      <h2
        className="px-5 py-2.5 text-xl font-bold text-white"
        style={{ backgroundColor: sectionColor }}
      >
        {index + 1}. {analysis.title}
      </h2>

      {analysis.status !== "available" || !analysis.snapshot ? (
        <div className="mt-7 border border-[#d9e0e3] p-5">
          <p className="font-bold text-[#536e7b]">
            {t(`status.${analysis.status}`)}
          </p>
          {analysis.timeSeries.length > 0 && (
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              {t("availablePeriods")}: {analysis.timeSeries.map((item) => item.period).join(", ")}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="mt-7 grid border border-[#d9e0e3] md:grid-cols-[1fr_226px]">
            <div className="p-5 text-[15px] leading-6 text-neutral-800">
              <p className="font-bold">
                Situação atual:{" "}
                <span className="font-normal text-[#536e7b]">
                  {report.municipality.name} — {report.municipality.uf}
                </span>
              </p>
              <p className="mt-2 text-justify">{situationText}</p>
            </div>
            {dominant && (
              <div
                className="flex min-h-40 flex-col items-center justify-center px-5 py-7 text-center text-white"
                style={{
                  backgroundColor: dominant.color || sectionColor,
                  color: textColorForBackground(dominant.color || sectionColor),
                }}
              >
                <strong className="text-lg">{dominant.label}</strong>
                <span className="mt-1 text-3xl font-bold">
                  {dominant.percentage.toFixed(1)}%
                </span>
                <span className="mt-2 text-xs">da área analisada</span>
              </div>
            )}
          </div>

          <h3 className="mt-8 text-lg font-bold text-[#536e7b]">
            Classes do {analysis.title}
          </h3>
          <div className="mt-3 overflow-hidden border border-[#c8ced1]">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[#176b39] text-white">
                <tr>
                  <th className="border-r border-white/40 px-4 py-2.5 text-left">Classe</th>
                  <th className="border-r border-white/40 px-4 py-2.5 text-left">Descrição</th>
                  <th className="w-36 px-4 py-2.5 text-right">Cobertura (%)</th>
                </tr>
              </thead>
              <tbody>
                {analysis.snapshot.distribution.map((item) => (
                  <tr key={item.id} className="border-t border-[#c8ced1]">
                    <td
                      className="border-r border-[#c8ced1] px-4 py-2.5 font-medium"
                      style={{ backgroundColor: `${item.color}33` }}
                    >
                      <span
                        className="mr-2 inline-block h-2.5 w-2.5 rounded-full border border-black/10"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.label}
                    </td>
                    <td className="border-r border-[#c8ced1] px-4 py-2.5 text-neutral-700">
                      {presentation?.history?.classes[item.id]?.description ?? presentation?.classes?.[item.id]?.description ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold">
                      {item.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {chartSrc && (
            <>
              <h3 className="mt-8 text-lg font-bold text-[#536e7b]">
                Distribuição espacial e variação temporal ({analysis.timeSeries[0]?.period?.slice(0, 4)}–{analysis.timeSeries.at(-1)?.period?.slice(0, 4)})
              </h3>
              <div className="mt-3 flex justify-center border border-[#d9e0e3] p-5">
                <img src={chartSrc} alt={`Série temporal - ${analysis.title}`} className="max-w-full" />
              </div>
            </>
          )}

          {historyNarrative ? (
            <div className="mt-7 border border-[#d9e0e3] p-5 text-[15px] leading-6">
              <h3 className="font-bold text-[#536e7b]">Análise da série histórica</h3>
              <p className="mt-2 text-justify text-neutral-800">
                <strong>Tendência recente:</strong> {historyNarrative.recent}
              </p>
              <p className="mt-3 text-justify text-neutral-800">
                <strong>Contexto histórico:</strong> {historyNarrative.context}
              </p>
            </div>
          ) : (
            <div className="mt-7 border border-[#d9e0e3] p-5 text-[15px] leading-6">
              <h3 className="font-bold text-[#536e7b]">Nota sobre a série histórica</h3>
              <p className="mt-1 text-justify text-neutral-800">
                A série disponível para este indicador reúne {analysis.timeSeries.length} período(s), de {formatReportPeriod(analysis.timeSeries[0]?.period ?? effectivePeriod ?? analysis.snapshot.period, locale)} a {formatReportPeriod(analysis.timeSeries.at(-1)?.period ?? effectivePeriod ?? analysis.snapshot.period, locale)}. O período efetivamente utilizado nesta análise foi {formatReportPeriod(effectivePeriod ?? analysis.snapshot.period, locale)}.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ReportDocument({ report, layerIds = [], charts, documentRef }: { report: MunicipalReportData; layerIds?: string[]; charts: Map<string, string>; documentRef?: React.Ref<HTMLElement> }) {
  const locale = useLocale();
  const generatedAt = new Date(report.generatedAt).toLocaleDateString(locale);
  const selected = layerIds.length
    ? report.analyses.filter(({ id }) => layerIds.includes(id))
    : report.analyses;
  const availableTitles = selected.map((analysis) => analysis.title).join(" · ");

  return (
    <article ref={documentRef} className="report-paper mt-6 bg-white text-[#202020] shadow-[0_8px_35px_rgba(0,0,0,0.12)]">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-4 text-xs text-[#0f5a2d]">
          <strong>SAP — Sistema de Alerta Precoce de Seca e Desertificação</strong>
          <span className="text-[#536e7b]">Relatório Analítico Automatizado</span>
          <div className="text-right">
            <strong>OCA / UFCG / INSA</strong>
            <div className="mt-1 text-[10px] font-normal text-[#536e7b]">beta-sap.lsd.ufcg.edu.br</div>
          </div>
        </div>

        <div className="mt-6 bg-[#125c2d] px-6 py-3 text-center text-white">
          <h1 className="text-[22px] font-bold uppercase leading-tight">
            Relatório Analítico do Sistema de Alerta Precoce de Seca e Desertificação
          </h1>
          <p className="mt-2 text-sm text-white/80">
            Lei nº 13.153/2015 · Política Nacional de Combate à Desertificação
          </p>
        </div>

        <div className="mt-6 border border-[#c8ced1] text-sm">
          <div className="grid grid-cols-[175px_1fr] border-b border-[#c8ced1] sm:grid-cols-[175px_1fr_105px_115px]">
            <strong className="bg-[#f1f2f2] px-3 py-2.5 text-[#536e7b]">Área de análise</strong>
            <span className="border-l border-[#c8ced1] px-3 py-2.5 font-bold">
              {report.municipality.name} — {report.municipality.uf}
            </span>
            <strong className="border-l border-[#c8ced1] bg-[#f1f2f2] px-3 py-2.5 text-center text-[#536e7b]">Escala</strong>
            <span className="border-l border-[#c8ced1] px-3 py-2.5 text-center">Municipal</span>
          </div>
          <div className="grid grid-cols-[175px_1fr] sm:grid-cols-[175px_1fr_105px_115px]">
            <strong className="bg-[#f1f2f2] px-3 py-2.5 text-[#536e7b]">Data de geração</strong>
            <span className="border-l border-[#c8ced1] px-3 py-2.5">{generatedAt}</span>
            <strong className="border-l border-[#c8ced1] bg-[#f1f2f2] px-3 py-2.5 text-center text-[#536e7b]">Referência</strong>
            <span className="border-l border-[#c8ced1] px-3 py-2.5 text-center">{report.requestedPeriod}</span>
          </div>
        </div>

        <div className="mt-5 grid border border-[#c8ced1] text-sm sm:grid-cols-[175px_1fr]">
          <strong className="bg-[#f1f2f2] px-3 py-2.5 text-[#536e7b]">Variáveis selecionadas</strong>
          <span className="border-l border-[#c8ced1] px-3 py-2.5">{availableTitles}</span>
        </div>
      </header>

      <div className="mt-10 space-y-12">
        {selected.map((analysis, index) => (
          <AnalysisSection
            key={analysis.id}
            analysis={analysis}
            report={report}
            index={index}
            locale={locale}
            chartSrc={charts.get(analysis.alias)}
          />
        ))}
      </div>

      <section className="mt-12 border-t border-[#d9e0e3] pt-8">
        <h2 className="text-xl font-bold text-[#536e7b]">Notas Metodológicas e Fontes</h2>
        <div className="mt-5 space-y-2 text-sm leading-5 text-neutral-800">
          {selected.map((analysis) => {
            const presentation = getMunicipalReportPresentation(analysis.id);
            return <p key={analysis.id}><strong>{analysis.title}:</strong> {presentation.methodology}</p>;
          })}
          <p><strong>Referência legal:</strong> Lei nº 13.153/2015 — Política Nacional de Combate à Desertificação e Mitigação dos Efeitos da Seca.</p>
        </div>
        <p className="mt-8 text-sm leading-5 text-[#536e7b]">
          Este relatório foi gerado automaticamente pelo Sistema de Alerta Precoce de Seca e Desertificação (SAP). Os valores apresentados são produzidos a partir dos dados disponíveis na plataforma.
        </p>
      </section>

      <footer className="mt-16 border-t border-[#d9e0e3] pt-3 text-[11px] text-[#536e7b]">
        SAP — Relatório Analítico | Gerado em: {generatedAt} | MMA/DCDE · OCA · UFCG · INSA
      </footer>
    </article>
  );
}

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

export function MunicipalReportPreview({ municipalityCode, period, layerIds, embedded = false }: MunicipalReportPreviewProps) {
  const t = useTranslations("MunicipalReport");
  const locale = useLocale();
  const hasRequiredParameters = Boolean(municipalityCode && period);
  const [report, setReport] = useState<MunicipalReportData | null>(null);
  const [charts, setCharts] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(hasRequiredParameters);
  const [exporting, setExporting] = useState(false);
  const [zoom, setZoom] = useState(75);
  const reportDocumentRef = useRef<HTMLElement>(null);
  const layerIdsKey = useMemo(() => layerIds?.join(",") ?? "", [layerIds]);

  function printReport() {
    if (!reportDocumentRef.current || exporting) return;

    setExporting(true);
    const printWindow = window.open("", "_blank", "popup,width=980,height=800");
    if (!printWindow) {
      setExporting(false);
      setError(t("popupBlocked"));
      return;
    }

    const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')]
      .map((element) => element.outerHTML)
      .join("\n");
    const baseUrl = `${window.location.origin}/`;
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><base href="${baseUrl}"><title>${t("reportLabel")}</title>${styles}<style>body{margin:0;background:#fff}.report-paper{margin:0!important;box-shadow:none!important}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${reportDocumentRef.current.outerHTML}</body></html>`);
    printWindow.document.close();

    const finish = () => {
      printWindow.focus();
      printWindow.print();
      setExporting(false);
    };
    printWindow.addEventListener("afterprint", () => printWindow.close(), { once: true });
    if (printWindow.document.readyState === "complete") {
      window.setTimeout(finish, 300);
    } else {
      printWindow.addEventListener("load", () => window.setTimeout(finish, 300), { once: true });
    }
  }

  useEffect(() => {
    if (!hasRequiredParameters) return;
    const controller = new AbortController();

    async function loadReport() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/municipal-report/${encodeURIComponent(municipalityCode)}?period=${encodeURIComponent(period)}`,
          { credentials: "same-origin", signal: controller.signal },
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? t("loadError"));
        setReport(payload as MunicipalReportData);

        // Fetch charts for all available analyses
        const reportData = payload as MunicipalReportData;
        const selectedLayerIds = layerIdsKey ? new Set(layerIdsKey.split(",")) : null;
        const selectedAliases = (selectedLayerIds
          ? reportData.analyses.filter(({ id }) => selectedLayerIds.has(id))
          : reportData.analyses
        )
          .filter((a) => a.status === "available")
          .map((a) => a.alias);

        if (selectedAliases.length === 0) {
          setCharts(new Map());
          return;
        }

        if (selectedAliases.length > 0) {
          const chartResponse = await fetch(
            `/api/municipal-report/${encodeURIComponent(municipalityCode)}/chart?period=${encodeURIComponent(period)}&analysis=${selectedAliases.join(",")}`,
            { credentials: "same-origin", signal: controller.signal },
          );
          if (chartResponse.ok) {
            const chartPayload = await chartResponse.json();
            const nextCharts = new Map<string, string>();
            for (const chart of chartPayload.charts) {
              nextCharts.set(chart.alias, `data:${chart.contentType};base64,${chart.base64}`);
            }
            setCharts(nextCharts);
          }
        }
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : t("loadError"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadReport();
    return () => controller.abort();
  }, [hasRequiredParameters, layerIdsKey, municipalityCode, period, t]);

  const visibleError = hasRequiredParameters ? error : null;

  if (embedded) {
    const municipality = citiesIndex.find((item) => item.code === municipalityCode);
    const filename = municipality
      ? `Relatório-${municipality.name.replace(/\s+/g, "-")}-${period}.PDF`
      : t("reportLabel");

    return (
      <div className="flex h-full min-w-0 flex-col bg-[#F6F7F6]">
        <div className="flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-[#EFEFEF] bg-[#E4E5E2] px-6">
          <span className="min-w-0 flex-1 truncate font-inter text-base">{filename}</span>
          <div className="flex shrink-0 items-center justify-center gap-6">
            <div className="flex h-10 items-center gap-2 font-inter text-base">
              <span className="flex h-10 w-[33px] items-center justify-center rounded-md border border-[#DCDBDC] bg-white text-[#7E797B]">1</span>
              <span className="text-[#292829]">/</span>
              <span className="text-[#292829]">--</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => setZoom((value) => Math.min(125, value + 10))} className="flex h-10 w-10 items-center justify-center rounded border border-[#EFEFEF] bg-white text-[#989F43]" aria-label={t("zoomIn")}>
                <svg className="h-6 w-6" aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M11 8v6M8 11h6M20 20l-3.5-3.5"/></svg>
              </button>
              <span className="flex h-10 w-[52px] items-center justify-center rounded-md border border-[#DCDBDC] bg-white px-2 font-inter text-base text-[#7E797B]">{zoom}%</span>
              <button type="button" onClick={() => setZoom((value) => Math.max(50, value - 10))} className="flex h-10 w-10 items-center justify-center rounded border border-[#EFEFEF] bg-white text-[#989F43]" aria-label={t("zoomOut")}>
                <svg className="h-6 w-6" aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M20 20l-3.5-3.5"/></svg>
              </button>
            </div>
          </div>
          <button type="button" disabled={!report || exporting} onClick={printReport} className="flex h-10 shrink-0 items-center gap-2 rounded bg-[#989F43] px-4 font-inter text-sm font-medium text-white disabled:opacity-50">
            {exporting ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <svg className="h-4 w-4" aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 20h14"/></svg>}
            {exporting ? t("preparingDownload") : t("download")}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-[#F6F7F6] px-8 py-8">
          {!hasRequiredParameters && <EmptyReportPreview />}
          {loading && <div className="mx-auto flex min-h-56 max-w-[749px] flex-col items-center justify-center gap-4 bg-white p-10 text-center text-neutral-600 shadow-sm"><span aria-hidden="true" className="h-9 w-9 animate-spin rounded-full border-4 border-[#989F43]/25 border-t-[#989F43]"/><strong className="text-base font-semibold text-[#536e7b]">{t("loading")}</strong><span className="text-sm">{t("loadingHint")}</span></div>}
          {visibleError && !loading && <div className="mx-auto max-w-[749px] border border-red-200 bg-white p-8 shadow-sm"><h1 className="text-xl font-semibold">{t("loadError")}</h1><p className="mt-2 text-sm text-red-700">{visibleError}</p></div>}
          {report && !loading && <div className="mx-auto origin-top transition-transform" style={{ width: "980px", transform: `scale(${zoom / 100})` }}><ReportDocument report={report} layerIds={layerIds} charts={charts} documentRef={reportDocumentRef} /></div>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#e9ece9] px-4 py-8 sm:px-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-[980px]">
        <Link href={`/${locale}/platform?section=communication`} className="text-sm font-semibold text-[#526426] hover:underline print:hidden">
          ← {t("back")}
        </Link>
        {loading && <div className="mt-6 bg-white p-10 text-center text-neutral-600 shadow-sm">{t("loading")}</div>}
        {visibleError && !loading && (
          <div className="mt-6 border border-red-200 bg-white p-8 shadow-sm">
            <h1 className="text-xl font-semibold">{t("loadError")}</h1>
            <p className="mt-2 text-sm text-red-700">{visibleError}</p>
          </div>
        )}
        {report && !loading && <ReportDocument report={report} layerIds={layerIds} charts={charts} />}
      </div>
    </div>
  );
}
