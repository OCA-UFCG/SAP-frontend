"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/Icon/Icon";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import type {
  AnalysisCoverage,
  AnalyzePayload,
  Cities,
  ExcludedCities,
} from "@/utils/amfeInterfaces";
import { downloadAnalysisWorkbook } from "./exportAnalysisWorkbook";
import {
  downloadAnalysisMapImage,
  type AnalysisMapImageOptions,
} from "./exportAnalysisMapImage";
import {
  PopupBlockedError,
  downloadAnalysisReport,
} from "./exportAnalysisReport";
import useCriterias from "./useCriterias";

interface AmfeMapDownloadMenuProps {
  cities: Cities;
  coverage: AnalysisCoverage | null;
  excludedCities: ExcludedCities;
  payload: AnalyzePayload | null;
  imageOptions: AnalysisMapImageOptions | null;
}

const ITEM_CLASS =
  "block w-full cursor-pointer rounded-lg px-4 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-[#646B2D]/10 hover:text-[#4F5424] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-gray-700";

export const AmfeMapDownloadMenu = ({
  cities,
  coverage,
  excludedCities,
  payload,
  imageOptions,
}: AmfeMapDownloadMenuProps) => {
  const t = useTranslations("Map");
  const locale = useLocale();
  const { criterias } = useCriterias();
  const criteriaLabels = useMemo(
    () =>
      Object.fromEntries(
        criterias.map((criterion) => [criterion.name, criterion.label]),
      ),
    [criterias],
  );
  const [isOpen, setIsOpen] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // O foco entra nas opções ao abrir, e Esc fecha com o foco de volta no botão.
  useDialogFocus(menuRef, {
    open: isOpen,
    onClose: () => setIsOpen(false),
    trapFocus: false,
  });

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  const handleWorkbook = () => {
    if (!payload) return;

    setIsOpen(false);
    void downloadAnalysisWorkbook(cities, payload, t);
  };

  const handleImage = async () => {
    if (!imageOptions) return;

    setIsOpen(false);
    setImageError(null);
    setIsExportingImage(true);

    try {
      await downloadAnalysisMapImage(imageOptions, t);
    } catch {
      setImageError(t("errorPng"));
    } finally {
      setIsExportingImage(false);
    }
  };

  const handleReport = async () => {
    if (!payload || !imageOptions) return;

    setIsOpen(false);
    setImageError(null);
    setIsExportingReport(true);

    try {
      await downloadAnalysisReport(
        imageOptions,
        cities,
        coverage,
        excludedCities,
        payload,
        criteriaLabels,
        t,
        locale,
      );
    } catch (error) {
      setImageError(
        error instanceof PopupBlockedError
          ? t("reportPopupBlocked")
          : t("errorReport"),
      );
    } finally {
      setIsExportingReport(false);
    }
  };

  return (
    <div ref={containerRef} className="absolute top-4 left-4 z-[1000]">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-busy={isExportingImage || isExportingReport}
        className="flex min-h-12 items-center gap-2 rounded-full border border-white/50 bg-[#646B2D] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.20)] transition-[background-color,translate,box-shadow,scale] duration-200 hover:bg-[#4F5424] hover:shadow-[0_14px_30px_rgba(33,36,15,0.30)] motion-safe:hover:-translate-y-0.5 active:scale-[0.97]"
      >
        {(isExportingImage || isExportingReport) && (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
        )}
        <span>{t("download")}</span>
        <Icon
          id="chevron-down"
          size={16}
          aria-hidden="true"
          className={`text-white transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="absolute top-full left-0 mt-2 min-w-36 origin-top overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-[0_14px_34px_rgba(0,0,0,0.18)] motion-safe:animate-[menu-in_180ms_ease-out] [&>*]:motion-safe:animate-[menu-item-in_260ms_ease-out_both] [&>:nth-child(2)]:[animation-delay:50ms] [&>:nth-child(3)]:[animation-delay:100ms]"
        >
          <button
            type="button"
            onClick={handleWorkbook}
            disabled={!payload}
            className={ITEM_CLASS}
          >
            XLSX
          </button>
          <button
            type="button"
            onClick={() => void handleImage()}
            disabled={!imageOptions || isExportingImage}
            className={ITEM_CLASS}
          >
            PNG
          </button>
          <button
            type="button"
            onClick={() => void handleReport()}
            disabled={!payload || !imageOptions || isExportingReport}
            className={ITEM_CLASS}
          >
            PDF
          </button>
        </div>
      )}

      {imageError && (
        <p
          role="alert"
          className="mt-2 max-w-56 rounded-lg bg-white/90 p-2 text-xs text-red-600 shadow-lg"
        >
          {imageError}
        </p>
      )}
    </div>
  );
};

export default AmfeMapDownloadMenu;
