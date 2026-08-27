"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/Icon/Icon";
import type { AnalyzePayload, Cities } from "@/utils/amfeInterfaces";
import { downloadAnalysisWorkbook } from "./exportAnalysisWorkbook";
import {
  downloadAnalysisMapImage,
  type AnalysisMapImageOptions,
} from "./exportAnalysisMapImage";

interface AmfeMapDownloadMenuProps {
  cities: Cities;
  payload: AnalyzePayload | null;
  imageOptions: AnalysisMapImageOptions | null;
}

const ITEM_CLASS =
  "block w-full cursor-pointer rounded-lg px-4 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-[#989F43]/10 hover:text-[#5f6528] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-gray-700";

export const AmfeMapDownloadMenu = ({
  cities,
  payload,
  imageOptions,
}: AmfeMapDownloadMenuProps) => {
  const t = useTranslations("Map");
  const [isOpen, setIsOpen] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div ref={containerRef} className="absolute top-4 left-4 z-[1000]">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-busy={isExportingImage}
        className="flex min-h-12 items-center gap-2 rounded-full border border-white/50 bg-[#989F43] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.20)] transition-colors hover:bg-[#858C38]"
      >
        {isExportingImage && (
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
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 min-w-36 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
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
