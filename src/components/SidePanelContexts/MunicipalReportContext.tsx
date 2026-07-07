"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { InfoModal } from "@/components/InfoModal/InfoModal";
import { LayerAccordion } from "@/components/LayerAccordion/LayerAccordion";
import citiesIndex from "@/data/citiesIndex.json";
import type { MunicipalReportData } from "@/contracts/municipalReport";
import type { PanelLayerI } from "@/utils/interfaces";

interface MunicipalReportContextProps { panelLayers?: PanelLayerI[] }

const CATEGORY_ORDER = ["Dados Climáticos", "Dados Ambientais", "Dados Socioeconômicos"];

interface ReportLayerGroup {
  key: string;
  title: string;
  layers: PanelLayerI[];
}

function canonicalCategoryTitle(category: string): string {
  return CATEGORY_ORDER.find(
    (item) => item.toLocaleLowerCase("pt-BR") === category.toLocaleLowerCase("pt-BR"),
  ) ?? category;
}

function categoryOrder(category: string) {
  const index = CATEGORY_ORDER.findIndex((item) => item.toLocaleLowerCase("pt-BR") === category.toLocaleLowerCase("pt-BR"));
  return index < 0 ? CATEGORY_ORDER.length : index;
}

export function MunicipalReportContext({ panelLayers = [] }: MunicipalReportContextProps) {
  const t = useTranslations("MunicipalReport");
  const tModules = useTranslations("ModulesContext");
  const locale = useLocale();
  const router = useRouter();
  const [municipalityCode, setMunicipalityCode] = useState("");
  const [period, setPeriod] = useState(String(new Date().getFullYear()));
  const [selectedLayers, setSelectedLayers] = useState<Set<string>>(new Set());
  const [availability, setAvailability] = useState<Map<string, boolean>>(new Map());
  const [availabilityState, setAvailabilityState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [infoLayer, setInfoLayer] = useState<PanelLayerI | null>(null);

  const municipalities = useMemo(
    () => [...citiesIndex].sort((left, right) => left.label.localeCompare(right.label, "pt-BR")),
    [],
  );
  const validPeriod = /^\d{4}(-\d{2})?$/.test(period);

  const groups = useMemo(() => {
    const grouped = new Map<string, ReportLayerGroup>();
    panelLayers.forEach((layer) => {
      const category = layer.category?.trim() || tModules("categories.others");
      const key = category.toLocaleLowerCase("pt-BR");
      const existingGroup = grouped.get(key);
      if (existingGroup) {
        existingGroup.layers.push(layer);
      } else {
        grouped.set(key, {
          key,
          title: canonicalCategoryTitle(category),
          layers: [layer],
        });
      }
    });
    return [...grouped.values()].sort((left, right) =>
      categoryOrder(left.title) - categoryOrder(right.title) || left.title.localeCompare(right.title, "pt-BR"),
    );
  }, [panelLayers, tModules]);

  useEffect(() => {
    if (!municipalityCode || !validPeriod) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAvailabilityState("loading");
      try {
        const response = await fetch(`/api/municipal-report/${municipalityCode}?period=${encodeURIComponent(period)}`, {
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const report = await response.json() as MunicipalReportData;
        const nextAvailability = new Map(report.analyses.map((analysis) => [analysis.id, analysis.status === "available"]));
        const availableIds = panelLayers.filter((layer) => nextAvailability.get(layer.id)).map((layer) => layer.id);
        setAvailability(nextAvailability);
        setSelectedLayers(new Set(availableIds));
        setAvailabilityState("ready");
      } catch {
        if (controller.signal.aborted) return;
        setAvailabilityState("error");
      }
    }, 350);

    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [municipalityCode, panelLayers, period, validPeriod]);

  const availableLayers = panelLayers.filter((layer) => availability.get(layer.id));
  const allAvailableSelected = availableLayers.length > 0 && availableLayers.every((layer) => selectedLayers.has(layer.id));
  const canSubmit = availabilityState === "ready" && selectedLayers.size > 0;

  function resetAvailability() {
    setSelectedLayers(new Set());
    setAvailability(new Map());
    setAvailabilityState("idle");
  }

  function toggleLayer(layerId: string) {
    if (!availability.get(layerId)) return;
    setSelectedLayers((current) => {
      const next = new Set(current);
      if (next.has(layerId)) next.delete(layerId); else next.add(layerId);
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    const params = new URLSearchParams({ municipalityCode, period, layers: [...selectedLayers].join(",") });
    router.push(`/${locale}/platform/municipal-report?${params.toString()}`);
  }

  return (
    <section className="h-full w-full overflow-y-auto bg-[#F6F7F6] px-4 py-12 text-[#292829]">
      <form onSubmit={handleSubmit} className="flex min-h-full flex-col gap-6">
        <header className="space-y-2">
          <h2 className="font-inter text-2xl font-semibold leading-6 tracking-[-0.015em]">{t("section")}</h2>
          <p className="font-inter text-base font-medium leading-6 tracking-[-0.015em]">{t("selectionDescription")}</p>
        </header>

        <fieldset className="space-y-2">
          <legend className="font-open-sans text-lg font-semibold leading-6">{t("selectArea")}</legend>
          <p className="font-inter text-xs font-medium leading-[18px] tracking-[-0.015em]">{t("selectAreaHint")}</p>
          <div className="flex gap-4 pt-2">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">{t("municipality")}</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
              <select value={municipalityCode} onChange={(event) => { setMunicipalityCode(event.target.value); resetAvailability(); }} className="h-10 w-full appearance-none rounded-lg border-0 bg-[#E4E5E2] pl-10 pr-7 text-sm outline-none focus:ring-2 focus:ring-[#989F43]">
                <option value="">{t("searchMunicipality")}</option>
                {municipalities.map((municipality) => <option key={municipality.code} value={municipality.code}>{municipality.label}</option>)}
              </select>
            </label>
            <input aria-label={t("period")} value={period} onChange={(event) => { setPeriod(event.target.value); resetAvailability(); }} placeholder="2024" className="h-10 w-24 rounded-lg border-0 bg-[#E4E5E2] px-3 text-sm outline-none focus:ring-2 focus:ring-[#989F43]" />
          </div>
          {!validPeriod && <p className="text-xs text-red-700">{t("invalidPeriod")}</p>}
        </fieldset>

        <fieldset className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <legend className="font-open-sans text-lg font-semibold leading-6">{t("selectModules")}</legend>
              {availabilityState === "ready" && availableLayers.length > 0 && <button type="button" onClick={() => setSelectedLayers(allAvailableSelected ? new Set() : new Set(availableLayers.map((layer) => layer.id)))} className="text-xs font-semibold text-[#777E32] hover:underline">{allAvailableSelected ? t("clearAll") : t("selectAll")}</button>}
            </div>
            <p className="font-inter text-xs font-medium leading-[18px] tracking-[-0.015em]">{t("selectModulesHint")}</p>
            <p className="min-h-[18px] font-inter text-xs leading-[18px] text-[#7E797B]" aria-live="polite">
              {availabilityState === "idle" && t("availabilityIdle")}
              {availabilityState === "loading" && t("checkingAvailability")}
              {availabilityState === "error" && t("availabilityError")}
              {availabilityState === "ready" && availableLayers.length === 0 && t("noModulesAvailable")}
            </p>
          </div>

          <div className="space-y-4">
            {groups.map((group, index) => (
              <LayerAccordion key={group.key} title={group.title} defaultOpen={index === 0}>
                <div className="flex flex-col gap-2">
                  {group.layers.map((layer) => {
                    const available = availabilityState === "ready" && availability.get(layer.id) === true;
                    return <div key={layer.id} className={`flex h-12 items-center rounded-lg border border-[#EFEFEF] bg-white ${available ? "" : "opacity-50"}`}>
                      <label className={`flex min-w-0 flex-1 items-center gap-1 py-1 pl-2 ${available ? "cursor-pointer" : "cursor-not-allowed"}`}>
                        <span className="flex h-10 w-[30px] items-center justify-center"><input type="checkbox" checked={selectedLayers.has(layer.id)} disabled={!available} onChange={() => toggleLayer(layer.id)} className="h-3.5 w-3.5 rounded-sm accent-[#989F43]" /></span>
                        <span className="min-w-0 flex-1 truncate font-inter text-base font-semibold leading-6 tracking-[-0.015em]" title={layer.name}>{layer.name}</span>
                      </label>
                      <button type="button" onClick={() => setInfoLayer(layer)} className="flex h-12 w-10 shrink-0 items-center justify-center border-l border-[#EFEFEF]" aria-label={t("moduleInformation", { title: layer.name })}><svg className="h-4 w-4" aria-hidden><use href="/sprite.svg#info"/></svg></button>
                    </div>;
                  })}
                </div>
              </LayerAccordion>
            ))}
          </div>
        </fieldset>

        <button type="submit" disabled={!canSubmit} className="mt-auto h-10 w-full shrink-0 rounded bg-[#989F43] px-4 font-open-sans text-sm text-white hover:bg-[#858c39] disabled:cursor-not-allowed disabled:opacity-50">{t("generateReport")}</button>
      </form>
      {infoLayer && <InfoModal card={{ id: 0, title: infoLayer.name, description: infoLayer.description, image: infoLayer.previewMap?.url, fileRef: infoLayer.id, imageData: infoLayer.imageData, timeScale: infoLayer.timeScale }} imageData={infoLayer.imageData} open onClose={() => setInfoLayer(null)} />}
    </section>
  );
}
