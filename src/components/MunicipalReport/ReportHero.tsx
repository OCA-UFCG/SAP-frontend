"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { MunicipalReportData } from "@/contracts/municipalReport";

export function ReportHero({
  report,
  period,
  onDownload,
  downloadDisabled = false,
  downloadLabel,
  title,
  subtitle,
}: {
  report: MunicipalReportData;
  period: string;
  onDownload?: () => void;
  downloadDisabled?: boolean;
  downloadLabel?: string;
  title?: string;
  subtitle?: string;
}) {
  const t = useTranslations("MunicipalReport");
  const locale = useLocale();
  const generatedAt = new Date(report.generatedAt).toLocaleDateString(locale);

  return (
    <header id="report-top" className="report-hero">
      <div className="flex h-14 items-center gap-6 bg-[#E4E5E2] px-10 py-4">
        <div className="flex h-full min-w-0 flex-1 items-center gap-2">
          <Image
            alt=""
            aria-hidden
            src="/sedes-mark-dark.svg"
            width={17}
            height={24}
            className="h-full w-auto"
          />
          <Image
            alt="SEDES"
            src="/sedes-wordmark-dark.svg"
            width={45}
            height={24}
            className="h-full w-auto"
          />
        </div>
        <p className="font-open-sans min-w-0 flex-1 text-right text-xs leading-6 text-[#292829]">
          {t("document.generatedLabel", { date: generatedAt })}
        </p>
      </div>

      <div className="flex flex-col items-center justify-center bg-[#F6F7F6] px-10 py-6">
        <div className="flex w-full flex-col items-start gap-2">
          <div className="flex w-full flex-col items-start gap-1">
            <p className="font-open-sans text-base font-semibold leading-6 text-[#292829]">
              {title ?? t("document.mainTitle")}
            </p>
            <h1 className="font-open-sans text-[40px] font-bold leading-[68px] text-[#989F43]">
              {report.municipality.name} - {report.municipality.uf}
            </h1>
            <p className="font-open-sans text-base leading-6 text-[#292829]">
              {subtitle ?? t("document.subtitle")}
            </p>
          </div>

          <div className="flex w-full items-start justify-between border-t border-[#989F43] pt-4">
            <dl className="font-open-sans flex items-center gap-6 text-xs leading-5 text-[#292829]">
              <div className="flex flex-col items-start">
                <dt className="font-semibold">
                  {t("document.referenceLabel")}
                </dt>
                <dd>{period}</dd>
              </div>
              <div className="flex flex-col items-start">
                <dt className="font-semibold">{t("document.scaleLabel")}</dt>
                <dd>{t("document.scaleValue")}</dd>
              </div>
            </dl>

            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                disabled={downloadDisabled}
                className="font-inter flex items-center justify-center gap-2 rounded bg-[#989F43] px-4 py-2 text-sm font-medium leading-6 text-[#F8F7F8] transition hover:bg-[#868D3B] disabled:cursor-not-allowed disabled:opacity-50 print:hidden"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="size-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                  <path d="M5 20h14" />
                </svg>
                {downloadLabel ?? t("downloadPdf")}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
