"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { LayerAccordion } from "@/components/LayerAccordion/LayerAccordion";
import SearchBarPlatform from "@/components/SidePanelContexts/SearchBarPlatform";
import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";
import type { PanelLayerI } from "@/utils/interfaces";
import type { SearchSubmissionMetadata } from "@/components/SearchBar/types";
import { trackUiEvent } from "@/services/telemetry/client";

interface CommunicationContextProps {
  activeSection: PlatformSection;
  panelLayers?: PanelLayerI[];
  onGenerateReport?: (selection: CommunicationReportSelection) => void;
}

interface ReportModule {
  key: string;
  title: string;
  items: Array<{
    key: string;
    label: string;
  }>;
}

export interface CommunicationReportSelection {
  area: string;
  items: string[];
}

const DROUGHT_ITEM_KEYS = [
  "aridity",
  "drought",
  "degradedArea",
  "ruralPoverty",
] as const;
const REPORT_MODULE_KEYS = [
  "drought",
  "desertification",
  "categories",
] as const;
const DEFAULT_SELECTED_ITEMS = new Set(["aridity", "ruralPoverty"]);

function buildReportModules(
  t: ReturnType<typeof useTranslations>,
): ReportModule[] {
  return REPORT_MODULE_KEYS.map((key) => ({
    key,
    title: t(`modules.${key}.title`),
    items:
      key === "drought"
        ? DROUGHT_ITEM_KEYS.map((itemKey) => ({
            key: itemKey,
            label: t(`modules.drought.items.${itemKey}`),
          }))
        : [],
  }));
}

export function CommunicationContext({
  activeSection,
  onGenerateReport,
}: CommunicationContextProps) {
  const t = useTranslations("CommunicationContext");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(
    DEFAULT_SELECTED_ITEMS,
  );
  const reportModules = useMemo(() => buildReportModules(t), [t]);
  const selectedReportItems = useMemo(
    () =>
      reportModules
        .flatMap((module) => module.items)
        .filter((item) => selectedItems.has(item.key))
        .map((item) => item.label),
    [reportModules, selectedItems],
  );

  const handleSearch = (value: string, metadata: SearchSubmissionMetadata) => {
    setSelectedArea(value);
    trackUiEvent({
      eventName: "search_found",
      surface: "analysis-panel",
      activeSection,
      query: value,
      ...metadata,
    });
  };

  const handleGenerateReport = () => {
    if (!selectedArea || selectedItems.size === 0) return;

    onGenerateReport?.({
      area: selectedArea,
      items: selectedReportItems,
    });
  };

  const handleItemToggle = (itemKey: string) => {
    setSelectedItems((currentItems) => {
      const nextItems = new Set(currentItems);

      if (nextItems.has(itemKey)) {
        nextItems.delete(itemKey);
      } else {
        nextItems.add(itemKey);
      }

      return nextItems;
    });
  };

  return (
    <div className="flex h-full flex-col bg-[#F6F7F6] px-4 pt-12 pb-6">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <h2 className="font-inter text-[24px] font-semibold leading-7 text-[#292829]">
              {t("title")}
            </h2>
            <p className="font-inter text-[16px] font-medium leading-6 text-[#292829]">
              {t("subtitle")}
            </p>
          </header>

          <section
            className="flex flex-col gap-3"
            aria-labelledby="communication-area-title"
          >
            <div className="flex flex-col gap-1">
              <h3
                id="communication-area-title"
                className="font-inter text-[17px] font-medium leading-6 text-[#292829]"
              >
                {t("areaTitle")}
              </h3>
              <p className="font-inter text-[12px] leading-4 text-[#292829]">
                {t("areaDescription")}
              </p>
            </div>

            <SearchBarPlatform
              onSearch={handleSearch}
              searchTelemetryContext={{
                activeLayerId: "communication-report",
                activeLayerName: t("title"),
                activeDateLabel: t("reportDateLabel"),
              }}
            />

            {selectedArea ? (
              <p className="font-inter text-[12px] font-medium text-[#777E32]">
                {t("selectedArea", { area: selectedArea })}
              </p>
            ) : null}
          </section>

          <section
            className="flex flex-col gap-3"
            aria-labelledby="communication-modules-title"
          >
            <div className="flex flex-col gap-1">
              <h3
                id="communication-modules-title"
                className="font-inter text-[17px] font-medium leading-6 text-[#292829]"
              >
                {t("modulesTitle")}
              </h3>
              <p className="font-inter text-[12px] leading-4 text-[#292829]">
                {t("modulesDescription")}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {reportModules.map((module) => (
                <LayerAccordion key={module.key} title={module.title}>
                  <ul className="flex flex-col gap-3">
                    {module.items.map((item) => (
                      <li key={item.key}>
                        <label className="flex h-11 cursor-pointer items-center gap-3 rounded-md border border-[#EFEFEF] bg-white px-3 font-inter text-sm font-semibold text-[#292829] shadow-sm transition hover:border-[#989F43]">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.key)}
                            onChange={() => handleItemToggle(item.key)}
                            className="h-4 w-4 accent-[#989F43]"
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {item.label}
                          </span>
                          <span
                            className="flex h-4 w-4 items-center justify-center rounded-full border border-[#989F43] text-[10px] font-semibold leading-none text-[#989F43]"
                            aria-hidden="true"
                          >
                            i
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </LayerAccordion>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="border-t border-transparent pt-4">
        <button
          type="button"
          disabled={!selectedArea || selectedItems.size === 0}
          onClick={handleGenerateReport}
          className="h-10 w-full rounded-lg bg-[#989F43] px-4 font-inter text-sm font-medium text-white transition hover:bg-[#858c35] active:brightness-95 disabled:cursor-not-allowed disabled:bg-[#B8BC7A] disabled:text-white/80"
        >
          {t("generateReport")}
        </button>
      </div>
    </div>
  );
}
