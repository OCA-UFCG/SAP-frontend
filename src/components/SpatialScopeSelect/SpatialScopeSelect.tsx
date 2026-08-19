"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  getDefaultSpatialValue,
  resolveSpatialSelection,
  SPATIAL_AREA_OPTIONS,
  SPATIAL_VALUE_OPTIONS,
  type SpatialSelection,
} from "@/utils/spatialScope";

export function SpatialScopeSelect({
  spatialSelection,
  onSpatialSelectionChange,
}: {
  spatialSelection: SpatialSelection;
  onSpatialSelectionChange: (value: SpatialSelection) => void;
}) {
  const t = useTranslations("AnalysisPanel");
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAreaOpen, setIsAreaOpen] = useState(false);
  const [isValueOpen, setIsValueOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsAreaOpen(false);
        setIsValueOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedArea = SPATIAL_AREA_OPTIONS.find(
    (area) => area.value === spatialSelection.spatialArea,
  );
  const valueOptions = SPATIAL_VALUE_OPTIONS[spatialSelection.spatialArea];
  const selectedValue =
    valueOptions.find(
      (option) => option.value === spatialSelection.spatialValue,
    ) ?? valueOptions[0];

  const selectArea = (spatialArea: (typeof SPATIAL_AREA_OPTIONS)[number]["value"]) => {
    const selection = resolveSpatialSelection(
      spatialArea,
      getDefaultSpatialValue(spatialArea),
    );
    if (selection.ok) onSpatialSelectionChange(selection.selection);
  };

  const selectValue = (spatialValue: string) => {
    const selection = resolveSpatialSelection(
      spatialSelection.spatialArea,
      spatialValue,
    );
    if (selection.ok) onSpatialSelectionChange(selection.selection);
  };

  return (
    <div ref={containerRef} className="flex w-full max-w-[392px] flex-col items-start gap-[6px]">
      <span
        id="spatial-scope-label"
        className="text-[14px] font-medium leading-[20px] text-[#292829]"
      >
        {t("spatialScope")}
      </span>
      <div className="flex w-full gap-2">
        <div className="relative flex-1">
          <button
            type="button"
            onClick={() => { setIsAreaOpen((c) => !c); setIsValueOpen(false); }}
            className="flex h-10 w-full items-center justify-between rounded-lg border border-transparent bg-[#E4E5E2] px-3 py-3 text-left text-sm shadow-sm transition hover:border-neutral-400"
            aria-haspopup="listbox"
            aria-expanded={isAreaOpen}
            aria-controls="spatial-area-options"
            aria-label={`${t("spatialScope")}: ${
              selectedArea ? t(selectedArea.labelKey) : t("selectArea")
            }`}
          >
            <span className="truncate text-[#292829]">
              {selectedArea ? t(selectedArea.labelKey) : t("selectArea")}
            </span>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`ml-2 shrink-0 text-[#898989] transition-transform ${isAreaOpen ? "rotate-180" : ""}`} aria-hidden="true">
              <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {isAreaOpen && (
            <div
              id="spatial-area-options"
              role="listbox"
              aria-labelledby="spatial-scope-label"
              className="absolute top-[calc(100%+8px)] z-20 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg"
            >
              {SPATIAL_AREA_OPTIONS.map((area) => (
                <button
                  key={area.value}
                  type="button"
                  role="option"
                  aria-selected={spatialSelection.spatialArea === area.value}
                  onClick={() => {
                    setIsAreaOpen(false);
                    selectArea(area.value);
                  }}
                  className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-[#292829] transition hover:bg-[#F6F7F6]"
                >
                  {t(area.labelKey)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative flex-1">
          <button
            type="button"
            onClick={() => { setIsValueOpen((c) => !c); setIsAreaOpen(false); }}
            className="flex h-10 w-full items-center justify-between rounded-lg border border-transparent bg-[#E4E5E2] px-3 py-3 text-left text-sm shadow-sm transition hover:border-neutral-400"
            aria-haspopup="listbox"
            aria-expanded={isValueOpen}
            aria-controls="spatial-value-options"
            aria-label={`${t("selectValue")}: ${
              selectedValue ? t(selectedValue.labelKey) : t("selectValue")
            }`}
          >
            <span className="truncate text-[#292829]">
              {selectedValue ? t(selectedValue.labelKey) : t("selectValue")}
            </span>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`ml-2 shrink-0 text-[#898989] transition-transform ${isValueOpen ? "rotate-180" : ""}`} aria-hidden="true">
              <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {isValueOpen && (
            <div
              id="spatial-value-options"
              role="listbox"
              aria-labelledby="spatial-scope-label"
              className="absolute top-[calc(100%+8px)] z-20 w-full max-h-64 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg"
            >
              {valueOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={
                    spatialSelection.spatialValue === option.value
                  }
                  onClick={() => {
                    setIsValueOpen(false);
                    selectValue(option.value);
                  }}
                  className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-[#292829] transition hover:bg-[#F6F7F6]"
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
