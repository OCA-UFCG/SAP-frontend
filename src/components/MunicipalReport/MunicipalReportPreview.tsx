"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type {
  MunicipalReportAnalysis,
  MunicipalReportData,
} from "@/contracts/municipalReport";
import { getMunicipalReportLayerConfig } from "@/config/municipalReport";
import {
  buildHistoryNarrative,
  buildSituationNarrative,
  formatReportPeriod,
} from "@/utils/municipalReportNarrative";

interface MunicipalReportPreviewProps {
  municipalityCode: string;
  period: string;
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
}: {
  analysis: MunicipalReportAnalysis;
  report: MunicipalReportData;
  index: number;
  locale: string;
}) {
  const t = useTranslations("MunicipalReport");
  const dominant = analysis.snapshot?.dominantClass;
  const layerConfig = getMunicipalReportLayerConfig(analysis.id);
  const presentation = layerConfig?.presentation;
  const situationText = presentation
    ? buildSituationNarrative(analysis, report, presentation, locale)
    : null;
  const sectionColor = presentation?.sectionColor ?? "#176b39";
  const effectivePeriod = analysis.effectivePeriod ?? analysis.snapshot?.period;
  const historyNarrative = presentation
    ? buildHistoryNarrative(analysis, report.municipality.name, presentation, locale)
    : null;

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

function ReportDocument({ report }: { report: MunicipalReportData }) {
  const locale = useLocale();
  const generatedAt = new Date(report.generatedAt).toLocaleDateString(locale);
  const availableTitles = report.analyses.map((analysis) => analysis.title).join(" · ");

  return (
    <article className="report-paper mt-6 bg-white text-[#202020] shadow-[0_8px_35px_rgba(0,0,0,0.12)]">
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
        {report.analyses.map((analysis, index) => (
          <AnalysisSection
            key={analysis.id}
            analysis={analysis}
            report={report}
            index={index}
            locale={locale}
          />
        ))}
      </div>

      <section className="mt-12 border-t border-[#d9e0e3] pt-8">
        <h2 className="text-xl font-bold text-[#536e7b]">Notas Metodológicas e Fontes</h2>
        <div className="mt-5 space-y-2 text-sm leading-5 text-neutral-800">
          {report.analyses.map((analysis) => {
            const config = getMunicipalReportLayerConfig(analysis.id);
            if (!config?.presentation.methodology) return null;
            return <p key={analysis.id}><strong>{analysis.title}:</strong> {config.presentation.methodology}</p>;
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

export function MunicipalReportPreview({ municipalityCode, period }: MunicipalReportPreviewProps) {
  const t = useTranslations("MunicipalReport");
  const locale = useLocale();
  const hasRequiredParameters = Boolean(municipalityCode && period);
  const [report, setReport] = useState<MunicipalReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(hasRequiredParameters);

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
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : t("loadError"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadReport();
    return () => controller.abort();
  }, [hasRequiredParameters, municipalityCode, period, t]);

  const visibleError = hasRequiredParameters ? error : t("missingParameters");

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
        {report && !loading && <ReportDocument report={report} />}
      </div>
    </div>
  );
}
