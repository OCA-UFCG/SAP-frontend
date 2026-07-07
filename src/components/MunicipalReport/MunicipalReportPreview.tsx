"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type {
  MunicipalReportAnalysis,
  MunicipalReportData,
} from "@/contracts/municipalReport";

interface MunicipalReportPreviewProps {
  municipalityCode: string;
  period: string;
}

function Distribution({ analysis }: { analysis: MunicipalReportAnalysis }) {
  if (!analysis.snapshot) return null;

  return (
    <div className="mt-5 space-y-3">
      {analysis.snapshot.distribution.map((item) => (
        <div key={item.id}>
          <div className="mb-1 flex justify-between gap-4 text-sm">
            <span className="text-neutral-700">{item.label}</span>
            <span className="font-semibold text-neutral-900">
              {item.percentage.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(0, item.percentage))}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MunicipalReportPreview({
  municipalityCode,
  period,
}: MunicipalReportPreviewProps) {
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
        if (!response.ok) {
          throw new Error(payload.error ?? t("loadError"));
        }
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

  const visibleError = hasRequiredParameters
    ? error
    : t("missingParameters");

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F1F2EF] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/${locale}/platform?section=communication`}
          className="text-sm font-semibold text-[#626827] hover:underline"
        >
          ← {t("back")}
        </Link>

        {loading && (
          <div className="mt-6 rounded-xl bg-white p-10 text-center text-neutral-600 shadow-sm">
            {t("loading")}
          </div>
        )}

        {visibleError && !loading && (
          <div className="mt-6 rounded-xl border border-red-200 bg-white p-8 shadow-sm">
            <h1 className="text-xl font-semibold text-neutral-900">
              {t("loadError")}
            </h1>
            <p className="mt-2 text-sm text-red-700">{visibleError}</p>
          </div>
        )}

        {report && !loading && (
          <article className="mt-6 overflow-hidden rounded-xl bg-white shadow-sm">
            <header className="border-b border-neutral-200 bg-[#F8F8EE] px-6 py-8 sm:px-10">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#777E32]">
                {t("reportLabel")}
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-neutral-900">
                {report.municipality.name} — {report.municipality.uf}
              </h1>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-600">
                <span>{t("ibgeCode")}: {report.municipality.code}</span>
                <span>{t("requestedPeriod")}: {report.requestedPeriod}</span>
                <span>{t("generatedAt")}: {new Date(report.generatedAt).toLocaleString(locale)}</span>
              </div>
            </header>

            <div className="space-y-8 p-6 sm:p-10">
              {report.analyses.map((analysis) => (
                <section key={analysis.id} className="rounded-xl border border-neutral-200 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-neutral-900">{analysis.title}</h2>
                      <p className="mt-1 text-sm text-neutral-500">
                        {analysis.effectivePeriod
                          ? `${t("effectivePeriod")}: ${analysis.effectivePeriod}`
                          : t(`status.${analysis.status}`)}
                      </p>
                    </div>
                    <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                      {t(`status.${analysis.status}`)}
                    </span>
                  </div>

                  {analysis.snapshot?.dominantClass && (
                    <div className="mt-5 rounded-lg bg-[#F6F7F2] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        {t("dominantClass")}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-neutral-900">
                        {analysis.snapshot.dominantClass.label} · {analysis.snapshot.dominantClass.percentage.toFixed(1)}%
                      </p>
                    </div>
                  )}

                  <Distribution analysis={analysis} />

                  {analysis.status === "period_not_found" && analysis.timeSeries.length > 0 && (
                    <p className="mt-5 text-sm text-amber-800">
                      {t("availablePeriods")}: {analysis.timeSeries.map((item) => item.period).join(", ")}
                    </p>
                  )}
                </section>
              ))}

              <section className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
                {t("futurePlaceholder")}
              </section>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
