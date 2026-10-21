"use client";

import { memo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type {
  MunicipalReportAnalysis,
  MunicipalReportData,
  MunicipalReportDocsContent,
} from "@/contracts/municipalReport";
import type { EeMapUrlFailure } from "@/contracts/eeMapUrls";
import { getMunicipalReportPresentation } from "@/config/municipalReport";
import {
  compactPeriodRange,
  formatReportPeriod,
} from "@/utils/municipalReportNarrative";
import { stableMunicipalReportAlias } from "@/utils/municipalReport";
import {
  getReportCategoryTokens,
  reportAnalysisAnchorId,
} from "@/utils/municipalReportCategories";
import {
  listForecastGroupPeriods,
  resolveForecastGroupPeriod,
  type ReportForecastGroup,
} from "@/utils/municipalReportForecast";
import {
  formatMunicipalReportValue,
  getMunicipalReportValueLabels,
} from "@/utils/municipalReportValue";
import {
  translateAnalysisMethodology,
  translateClassLabel,
} from "@/utils/municipalReportTranslations";
import { MunicipalReportClassBars } from "./MunicipalReportClassBars";
import { ReportMapPreview, type ReportMapChoropleth } from "./ReportMapPreview";
import { ReportSectionHeading } from "./ReportSectionHeading";
import type { ReportMapThumbnail } from "./reportMapView";

type Translate = ReturnType<typeof useTranslations>;

/** O que cada mapa do grupo precisa da fila de captura do documento. */
export interface ReportForecastMapProps {
  mapKey: string;
  mapSrc?: string;
  mapActive?: boolean;
  mapAttempt?: number;
  mapTileUrl?: string;
  mapThumbnail?: ReportMapThumbnail;
  mapChoropleth?: ReportMapChoropleth;
  mapUnavailableReason?: EeMapUrlFailure;
}

function isAvailable(analysis: MunicipalReportAnalysis) {
  return analysis.status === "available" && Boolean(analysis.snapshot);
}

/**
 * Um valor dos filtros da previsão como foi escrito no catálogo ("Anomalia",
 * "Precipitação"), traduzido quando o dicionário conhece a palavra.
 */
function translateFacet(value: string, t: Translate) {
  const key = `forecast.facets.${stableMunicipalReportAlias(value)}`;
  return t.has(key) ? t(key) : value;
}

/**
 * O título da seção, que também é a linha dela no sumário.
 *
 * @example
 * forecastGroupTitle(group, t); // "Previsão: Precipitação (INMET)"
 */
export function forecastGroupTitle(group: ReportForecastGroup, t: Translate) {
  const values = {
    variable: translateFacet(group.variable, t),
    source: group.source,
  };
  return group.showPeriodicity
    ? t("forecast.titleWithPeriodicity", {
        ...values,
        periodicity: t(`forecast.periodicity.${group.periodicity}`).toLowerCase(),
      })
    : t("forecast.title", values);
}

/**
 * As notas metodológicas do grupo, sem repetir o texto que os tipos dividem:
 * as previsões de uma fonte costumam ter a mesma nota em todas as camadas.
 */
export function forecastGroupMethodologies(
  group: ReportForecastGroup,
  docsContent: MunicipalReportDocsContent | null,
  locale: string,
  t: Translate,
  tModules: Translate,
) {
  const notes: string[] = [];
  for (const member of group.members) {
    const text = translateAnalysisMethodology(
      member,
      docsContent,
      member.presentation?.methodology ??
        getMunicipalReportPresentation(member.id).methodology,
      (key) => t(key),
      (key) => t.has(key),
      (key) => tModules(key),
      (key) => tModules.has(key),
      locale,
    ).trim();
    if (text && !notes.includes(text)) notes.push(text);
  }
  return notes;
}

/** "nov/2026": o rótulo da barra cabe numa linha do cartão estreito. */
function formatShortPeriod(period: string, locale: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return formatReportPeriod(period, locale);
  const month = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  })
    .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)))
    .replace(".", "");
  return `${month}/${match[1]}`;
}

function memberPeriod(analysis: MunicipalReportAnalysis) {
  return analysis.effectivePeriod ?? analysis.snapshot?.period ?? null;
}

/**
 * A distribuição de um tipo ao longo da série: uma barra empilhada por
 * período, com a do período de referência destacada, e a legenda com os
 * valores dela. Só para classes que somam 100% — um valor absoluto não se
 * empilha, e cai nas barras de sempre.
 */
function ForecastCoverage({
  analysis,
  locale,
  translateLabel,
}: {
  analysis: MunicipalReportAnalysis;
  locale: string;
  translateLabel: (label: string) => string;
}) {
  if (analysis.valueType !== "percentage") {
    return (
      <MunicipalReportClassBars
        analysis={analysis}
        locale={locale}
        translateLabel={translateLabel}
      />
    );
  }

  const reference = analysis.snapshot;
  const series = analysis.timeSeries.length
    ? analysis.timeSeries
    : reference
      ? [reference]
      : [];
  const legend = (reference?.distribution ?? []).filter(
    (item) => item.percentage > 0,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        {series.map((snapshot) => {
          const isReference = snapshot.period === reference?.period;
          return (
            <div
              key={snapshot.period}
              data-report-forecast-bar={snapshot.period}
              data-reference={isReference || undefined}
              className={`flex items-center gap-2 ${isReference ? "" : "opacity-55"}`}
            >
              <span
                className={`w-[58px] shrink-0 text-[11px] leading-4 tabular-nums text-[#292829] ${isReference ? "font-bold" : ""}`}
              >
                {formatShortPeriod(snapshot.period, locale)}
              </span>
              <span
                className={`flex h-3.5 min-w-0 flex-1 overflow-hidden rounded-sm ${isReference ? "ring-1 ring-[#292829]/40" : ""}`}
                role="img"
                aria-label={snapshot.distribution
                  .filter((item) => item.percentage > 0)
                  .map(
                    (item) =>
                      `${translateLabel(item.label)}: ${formatMunicipalReportValue(item.percentage, analysis, locale)}`,
                  )
                  .join("; ")}
              >
                {snapshot.distribution
                  .filter((item) => item.percentage > 0)
                  .map((item) => (
                    <span
                      key={item.id}
                      className="block h-full"
                      style={{
                        width: `${Number(item.percentage.toFixed(4))}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  ))}
              </span>
            </div>
          );
        })}
      </div>
      {legend.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs leading-5 text-[#292829]">
          {legend.map((item) => (
            <li key={item.id} className="flex items-start gap-1.5">
              <span
                aria-hidden="true"
                className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-[2px] border border-black/10"
                style={{ backgroundColor: item.color }}
              />
              <span>
                {translateLabel(item.label)} —{" "}
                <span className="tabular-nums">
                  {formatMunicipalReportValue(item.percentage, analysis, locale)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A seção de uma previsão climática: os tipos da mesma fonte, variável e
 * periodicidade lado a lado, com uma situação, um mapa e uma distribuição por
 * tipo. Substitui as seções separadas que cada tipo tinha.
 */
export const ReportForecastSection = memo(function ReportForecastSection({
  group,
  report,
  locale,
  docsContent,
  mapPropsFor,
  mapQueuedAt,
  onMapCapture,
  onMapRetry,
  onMapVisibility,
  monitorHref,
  onOpenMonitor,
}: {
  group: ReportForecastGroup;
  report: MunicipalReportData;
  locale: string;
  docsContent: MunicipalReportDocsContent | null;
  mapPropsFor: (analysis: MunicipalReportAnalysis) => ReportForecastMapProps;
  mapQueuedAt?: number | null;
  onMapCapture?: (key: string, src: string | null) => void;
  onMapRetry?: (key: string) => void;
  onMapVisibility?: (key: string, visible: boolean) => void;
  monitorHref: (analysisId: string) => string;
  onOpenMonitor?: (layerId: string) => void;
}) {
  const t = useTranslations("MunicipalReport");
  const tModules = useTranslations("ModulesContext");
  const tCaption = useTranslations("PlatformMapCaption");
  const translateLabel = (label: string) =>
    translateClassLabel(
      label,
      (key) => t(key),
      (key) => t.has(key),
      (key) => tCaption(key),
      (key) => tCaption.has(key),
    );
  const accent = getReportCategoryTokens(group.category).accent;
  const title = forecastGroupTitle(group, t);
  const referencePeriod = resolveForecastGroupPeriod(group) ?? report.requestedPeriod;
  const referenceLabel = formatReportPeriod(referencePeriod, locale);
  const seriesRange = compactPeriodRange(
    listForecastGroupPeriods(group).map((period) => ({
      period,
      label: period,
      distribution: [],
      dominantClass: null,
    })),
    referencePeriod,
    locale,
    (key, values) => t(key, values),
  );
  const available = group.members.filter(isAvailable);
  const firstAvailable = available[0] ?? group.members[0];
  const kindOf = (analysis: MunicipalReportAnalysis) =>
    translateFacet(analysis.forecast?.kind ?? analysis.title, t);

  const situationItems = available.flatMap((analysis) => {
    const dominant = analysis.snapshot?.dominantClass;
    if (!dominant) return [];
    const period = memberPeriod(analysis);
    const values = {
      kind: kindOf(analysis).toLocaleLowerCase(locale),
      className: translateLabel(dominant.label),
      value: formatMunicipalReportValue(dominant.percentage, analysis, locale),
      context: getMunicipalReportValueLabels(analysis, (key, v) => t(key, v))
        .cardContext,
    };
    return [
      period && period !== referencePeriod
        ? t("forecast.situationItemPeriod", {
            ...values,
            period: formatReportPeriod(period, locale),
          })
        : t("forecast.situationItem", values),
    ];
  });
  const situationText =
    situationItems.length > 0
      ? t("forecast.situation", {
          prepositional: report.territory.prepositionalLabel,
          territory: report.territory.label,
          period: referenceLabel,
          variable: translateFacet(group.variable, t).toLocaleLowerCase(locale),
          source: group.source,
          items: new Intl.ListFormat(locale, {
            style: "long",
            type: "conjunction",
          }).format(situationItems),
        })
      : null;

  const kindDescriptions = group.members.flatMap((analysis) => {
    const key = `forecast.kindDescriptions.${stableMunicipalReportAlias(analysis.forecast?.kind ?? "")}`;
    return t.has(key) ? [t(key)] : [];
  });
  const methodologies = forecastGroupMethodologies(
    group,
    docsContent,
    locale,
    t,
    tModules,
  );
  const columns =
    group.members.length >= 3
      ? "md:grid-cols-3"
      : group.members.length === 2
        ? "md:grid-cols-2"
        : "";

  return (
    <section
      id={reportAnalysisAnchorId(group.alias)}
      className="report-section report-forecast-section scroll-mt-16"
    >
      <div
        className="report-analysis-header report-block flex flex-wrap items-center justify-between gap-4 rounded-r-lg border-l-[3px] bg-[#F8F7F8] px-4 py-2"
        style={{ borderLeftColor: accent }}
      >
        <div className="min-w-0">
          <h2 className="font-open-sans text-[18px] font-bold leading-[1.5] tracking-[-0.216px] text-[#292829]">
            {title}
          </h2>
          <p className="font-open-sans flex flex-wrap gap-1 text-xs leading-5 text-[#292829]">
            <strong className="font-semibold">{t("availableSeries")}:</strong>
            {seriesRange} ·{" "}
            {t("forecast.referencePeriod", { period: referenceLabel })}
          </p>
        </div>
        <Link
          href={monitorHref(firstAvailable.id)}
          onClick={(event) => {
            if (!onOpenMonitor || event.metaKey || event.ctrlKey) return;
            event.preventDefault();
            onOpenMonitor(firstAvailable.id);
          }}
          className="font-open-sans shrink-0 rounded-md bg-[#989F43] px-4 py-2 text-sm leading-6 text-white transition hover:bg-[#868D3B] print:hidden"
        >
          {t("document.viewMonitor")}
        </Link>
      </div>

      <dl className="report-block report-forecast-facets mt-3 flex flex-wrap gap-x-6 gap-y-1 border-y border-[#E4E4E4] py-2.5 text-sm text-[#292829]">
        {(
          [
            ["sourceLabel", group.source],
            ["variableLabel", translateFacet(group.variable, t)],
            [
              "periodicityLabel",
              t(`forecast.periodicity.${group.periodicity}`),
            ],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex gap-1.5">
            <dt className="text-[#7E797B]">{t(`forecast.${label}`)}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      {available.length === 0 ? (
        <div className="report-analysis-summary report-block mt-6 border border-[#d9e0e3] p-5">
          <p className="font-bold text-[#536e7b]">
            {t(`status.${firstAvailable.status}`)}
          </p>
        </div>
      ) : (
        <>
          {situationText && (
            <div className="report-situation mt-7">
              <ReportSectionHeading level={3} accent={accent}>
                {t("document.situationTitle")}
              </ReportSectionHeading>
              <p className="mt-4 text-[15px] leading-7 text-[#2C3A31]">
                {situationText}
              </p>
            </div>
          )}

          <div className="report-spatial report-forecast-maps mt-8">
            <ReportSectionHeading level={3} accent={accent}>
              {t("document.spatialDistributionTitle")} — {referenceLabel}
            </ReportSectionHeading>
            <div className={`mt-4 grid gap-4 ${columns}`}>
              {group.members.map((analysis) => {
                const dominant = analysis.snapshot?.dominantClass;
                const map = mapPropsFor(analysis);
                const period = memberPeriod(analysis);
                return (
                  <div
                    key={analysis.id}
                    className="report-block flex min-w-0 flex-col gap-3 overflow-hidden rounded-lg border border-[#EFEFEF] bg-[#F6F7F6] p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-open-sans text-sm font-bold text-[#292829]">
                        {kindOf(analysis)}
                      </p>
                      <p className="text-xs leading-5 text-[#58655C]">
                        {dominant
                          ? `${formatMunicipalReportValue(dominant.percentage, analysis, locale)} · ${translateLabel(dominant.label)}`
                          : t("forecast.noData")}
                        {period && period !== referencePeriod
                          ? ` · ${formatReportPeriod(period, locale)}`
                          : ""}
                      </p>
                    </div>
                    {isAvailable(analysis) && (
                      <ReportMapPreview
                        territory={report.territory}
                        imageAlt={t("mapAlt", {
                          layer: kindOf(analysis),
                          territory: report.territory.label,
                          period: formatReportPeriod(
                            period ?? referencePeriod,
                            locale,
                          ),
                        })}
                        layerId={analysis.id}
                        period={period ?? referencePeriod}
                        className="report-map-frame aspect-[696/322] w-full rounded-lg bg-white"
                        active={map.mapActive}
                        attempt={map.mapAttempt}
                        imageSrc={map.mapSrc}
                        queuedAt={mapQueuedAt}
                        tileUrl={map.mapTileUrl}
                        thumbnail={map.mapThumbnail}
                        choropleth={map.mapChoropleth}
                        clipToTerritory
                        unavailableReason={map.mapUnavailableReason}
                        onCapture={(src) => onMapCapture?.(map.mapKey, src)}
                        onRetry={onMapRetry && (() => onMapRetry(map.mapKey))}
                        onVisibilityChange={(visible) =>
                          onMapVisibility?.(map.mapKey, visible)
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="font-open-sans mt-2 text-xs leading-5 text-[#7E797B]">
              {t("forecast.spatialCaption", {
                boundary: report.territory.possessiveLabel,
                territory: report.territory.label,
                period: referenceLabel,
              })}
            </p>
          </div>

          <div className="report-class-coverage mt-8">
            <ReportSectionHeading level={3} accent={accent}>
              {t("document.classCoverageTitle")}
            </ReportSectionHeading>
            <div className={`mt-4 grid gap-4 ${columns}`}>
              {group.members.map((analysis) => (
                <div
                  key={analysis.id}
                  className="report-block flex min-w-0 flex-col gap-3 rounded-lg border border-[#EFEFEF] bg-[#F6F7F6] p-3"
                >
                  <p className="font-open-sans text-sm font-bold text-[#292829]">
                    {kindOf(analysis)}
                  </p>
                  {isAvailable(analysis) ? (
                    <ForecastCoverage
                      analysis={analysis}
                      locale={locale}
                      translateLabel={translateLabel}
                    />
                  ) : (
                    <p className="text-xs text-[#58655C]">
                      {t("forecast.noData")}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="font-open-sans mt-2 text-xs leading-5 text-[#7E797B]">
              {t("forecast.coverageCaption", { period: referenceLabel })}
            </p>
          </div>
        </>
      )}

      {(kindDescriptions.length > 0 || methodologies.length > 0) && (
        <div className="report-narrative mt-8">
          <ReportSectionHeading level={3} accent={accent}>
            {t("forecast.methodologyTitle")}
          </ReportSectionHeading>
          <p className="mt-4 whitespace-pre-line text-[15px] leading-7 text-[#2C3A31]">
            {[...kindDescriptions, ...methodologies].join(" ")}
          </p>
        </div>
      )}
    </section>
  );
});
