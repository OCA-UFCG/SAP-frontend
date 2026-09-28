"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { InfoModal } from "@/components/InfoModal/InfoModal";
import { LayerAccordion } from "@/components/LayerAccordion/LayerAccordion";
import { PanelDropdown } from "@/components/PanelDropdown/PanelDropdown";
import citiesIndex from "@/data/citiesIndex.json";
import municipalAvailabilityIndex from "@/data/municipalAvailabilityIndex.json";
import type { MunicipalAvailabilityIndex } from "@/utils/municipalAvailability";
import {
  getSelectableReportLayerIds,
  isReportEnabledLayer,
} from "@/utils/reportLayerAvailability";
import {
  getReportTerritoryForSelection,
  resolveReportTerritory,
  type ReportTerritory,
} from "@/utils/reportTerritory";
import {
  getDefaultSpatialValue,
  SPATIAL_AREA_OPTIONS,
  SPATIAL_VALUE_OPTIONS,
  type SpatialArea,
  type SpatialSelection,
} from "@/utils/spatialScope";
import { resolveReportCategoryKey } from "@/utils/municipalReportCategories";
import {
  flattenLayerSubgroups,
  splitIntoLayerSubgroups,
  type SubgroupedItems,
} from "@/utils/layerSubgroups";
import type { PanelLayerI } from "@/utils/interfaces";
import { startMunicipalReportMetrics } from "@/utils/municipalReportMetrics";
import { slugifyTranslationKey } from "@/utils/translations";

interface MunicipalReportContextProps { panelLayers?: PanelLayerI[] }

const CATEGORY_ORDER = ["Dados Climáticos", "Dados Ambientais", "Dados Socioeconômicos"];
const REPORT_DEFAULT_PERIOD = "2026";

/**
 * O recorte do relatório. "municipality" não é uma área de interesse do painel
 * de Monitoramento — é a malha municipal —, por isso ele entra aqui ao lado das
 * áreas em vez de dentro delas. Fica primeiro porque é o relatório mais pedido.
 */
type ReportScope = "municipality" | SpatialArea;

const REPORT_SCOPE_OPTIONS: readonly ReportScope[] = [
  "municipality",
  ...SPATIAL_AREA_OPTIONS.map((option) => option.value),
];

interface ReportCategoryLayers {
  key: string;
  title: string;
  layers: PanelLayerI[];
}

type ReportLayerGroup = ReportCategoryLayers & SubgroupedItems<PanelLayerI>;

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
  const tAnalysis = useTranslations("AnalysisPanel");
  const municipalityPickerRef = useRef<HTMLDivElement>(null);
  const [scope, setScope] = useState<ReportScope>("municipality");
  const [spatialValue, setSpatialValue] = useState("");
  const [municipalityCode, setMunicipalityCode] = useState("");
  const [municipalityQuery, setMunicipalityQuery] = useState("");
  const [isMunicipalityOptionsOpen, setIsMunicipalityOptionsOpen] = useState(false);
  const period = REPORT_DEFAULT_PERIOD;
  const [selectedLayers, setSelectedLayers] = useState<Set<string>>(
    () => new Set(panelLayers.map((layer) => layer.id)),
  );
  const [infoLayer, setInfoLayer] = useState<PanelLayerI | null>(null);
  const [isGenerating, startGenerating] = useTransition();

  const municipalities = useMemo(
    () => [...citiesIndex].sort((left, right) => left.label.localeCompare(right.label, "pt-BR")),
    [],
  );
  const selectedMunicipality = useMemo(
    () => municipalities.find((municipality) => municipality.code === municipalityCode),
    [municipalities, municipalityCode],
  );
  const filteredMunicipalities = useMemo(() => {
    const normalizedQuery = municipalityQuery.trim().toLocaleLowerCase("pt-BR");
    const options = normalizedQuery
      ? municipalities.filter((municipality) => municipality.label.toLocaleLowerCase("pt-BR").includes(normalizedQuery))
      : municipalities;

    return options.slice(0, 80);
  }, [municipalities, municipalityQuery]);
  const validPeriod = /^\d{4}(-\d{2})?$/.test(period);

  /**
   * O território do relatório: o município escolhido na busca ou o recorte
   * escolhido nos dois seletores. É ele que vira a chave territorial do pedido,
   * e é dele que sai a lista de índices disponíveis.
   */
  const territory = useMemo((): ReportTerritory | null => {
    if (scope === "municipality") {
      return municipalityCode ? resolveReportTerritory(municipalityCode) : null;
    }
    if (!spatialValue) return null;

    return getReportTerritoryForSelection({
      spatialArea: scope,
      spatialValue,
    } as SpatialSelection);
  }, [municipalityCode, scope, spatialValue]);

  // Um índice que o catálogo tirou do relatório não aparece nem desabilitado:
  // ele não é uma opção indisponível para este território, ele não é opção.
  const reportLayers = useMemo(
    () => panelLayers.filter(isReportEnabledLayer),
    [panelLayers],
  );

  const groups = useMemo((): ReportLayerGroup[] => {
    const grouped = new Map<string, ReportCategoryLayers>();
    reportLayers.forEach((layer) => {
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
    return [...grouped.values()]
      .sort((left, right) =>
        categoryOrder(left.title) - categoryOrder(right.title) || left.title.localeCompare(right.title, "pt-BR"),
      )
      .map((group) => ({
        ...group,
        ...splitIntoLayerSubgroups(group.title, group.layers, (layer) => layer.name),
      }));
  }, [reportLayers, tModules]);

  // This is the exact visual order used by the module checkboxes. Keep the
  // generated report request in the same sequence, independently of the order
  // in which a checkbox was toggled. Subgroups sit at the end of their
  // category, so their sections come last too.
  const orderedPanelLayers = useMemo(
    () => groups.flatMap(flattenLayerSubgroups),
    [groups],
  );

  const availableLayerIds = useMemo(() => {
    if (!territory || !validPeriod) return new Set<string>();
    return getSelectableReportLayerIds(
      reportLayers,
      municipalAvailabilityIndex as MunicipalAvailabilityIndex,
      territory,
      period,
    );
  }, [period, reportLayers, territory, validPeriod]);

  const availability = useMemo(
    () => new Map(reportLayers.map((layer) => [layer.id, availableLayerIds.has(layer.id)])),
    [availableLayerIds, reportLayers],
  );
  const availabilityState = territory && validPeriod ? "ready" : "idle";

  function translatedCategoryTitle(group: ReportLayerGroup) {
    return tModules(`categories.${resolveReportCategoryKey(group.title)}`);
  }

  function translatedLayerTitle(layer: PanelLayerI) {
    const translationKey = `Layers.${slugifyTranslationKey(layer.name)}.title`;
    return tModules.has(translationKey) ? tModules(translationKey) : layer.name;
  }

  function renderLayerOption(layer: PanelLayerI) {
    const available = availabilityState === "ready" && availability.get(layer.id) === true;
    const layerTitle = translatedLayerTitle(layer);
    return <div key={layer.id} className={`flex h-12 items-center rounded-lg border border-[#EFEFEF] bg-white ${available ? "" : "opacity-50"}`}>
      <label className={`flex min-w-0 flex-1 items-center gap-1 py-1 pl-2 ${available ? "cursor-pointer" : "cursor-not-allowed"}`}>
        <span className="flex h-10 w-[30px] items-center justify-center"><input type="checkbox" checked={selectedLayers.has(layer.id)} disabled={!available} onChange={() => toggleLayer(layer.id)} className="h-3.5 w-3.5 rounded-sm accent-[#989F43]" /></span>
        <span className="min-w-0 flex-1 truncate font-inter text-base font-semibold leading-6 tracking-[-0.015em]" title={layerTitle}>{layerTitle}</span>
      </label>
      <button type="button" onClick={() => setInfoLayer(layer)} className="flex h-12 w-10 shrink-0 items-center justify-center border-l border-[#EFEFEF]" aria-label={t("moduleInformation", { title: layerTitle })}><svg className="h-4 w-4 text-[#2C1E1C]" aria-hidden><use href="/sprite.svg#info"/></svg></button>
    </div>;
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!municipalityPickerRef.current?.contains(target)) {
        setIsMunicipalityOptionsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const availableLayers = orderedPanelLayers.filter((layer) => availability.get(layer.id));
  const allAvailableSelected = availableLayers.length > 0 && availableLayers.every((layer) => selectedLayers.has(layer.id));
  const selectedAvailableLayers = orderedPanelLayers
    .filter((layer) => availability.get(layer.id) && selectedLayers.has(layer.id))
    .map((layer) => layer.id);
  const canSubmit = availabilityState === "ready" && selectedAvailableLayers.length > 0;

  function resetAvailability() {
    setSelectedLayers(new Set());
  }

  function getDefaultSelectedLayers(
    selectedTerritory: ReportTerritory | null,
    selectedPeriod: string,
  ) {
    if (!selectedTerritory) return new Set<string>();
    if (!/^\d{4}(-\d{2})?$/.test(selectedPeriod)) return new Set<string>();
    return getSelectableReportLayerIds(
      reportLayers,
      municipalAvailabilityIndex as MunicipalAvailabilityIndex,
      selectedTerritory,
      selectedPeriod,
    );
  }

  function selectMunicipality(code: string, label: string) {
    setMunicipalityCode(code);
    setMunicipalityQuery(label);
    setIsMunicipalityOptionsOpen(false);
    setSelectedLayers(
      getDefaultSelectedLayers(resolveReportTerritory(code), period),
    );
  }

  /**
   * Trocar de recorte zera o território: um estado não é um município, e manter
   * a seleção anterior deixaria o formulário descrevendo um lugar que o novo
   * recorte não tem. O Brasil é a exceção, porque tem um valor só.
   */
  function selectScope(nextScope: ReportScope) {
    setScope(nextScope);
    setMunicipalityCode("");
    setMunicipalityQuery("");
    const nextValue =
      nextScope === "municipality"
        ? ""
        : SPATIAL_VALUE_OPTIONS[nextScope].length === 1
          ? getDefaultSpatialValue(nextScope)
          : "";
    setSpatialValue(nextValue);
    setSelectedLayers(
      getDefaultSelectedLayers(
        nextValue
          ? getReportTerritoryForSelection({
              spatialArea: nextScope,
              spatialValue: nextValue,
            } as SpatialSelection)
          : null,
        period,
      ),
    );
  }

  function selectSpatialValue(value: string) {
    if (scope === "municipality") return;
    setSpatialValue(value);
    setSelectedLayers(
      getDefaultSelectedLayers(
        getReportTerritoryForSelection({
          spatialArea: scope,
          spatialValue: value,
        } as SpatialSelection),
        period,
      ),
    );
  }

  function clearMunicipalityQuery() {
    setMunicipalityCode("");
    setMunicipalityQuery("");
    resetAvailability();
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
    if (!canSubmit || !territory) return;
    startMunicipalReportMetrics({
      territorio: territory.locationKey,
      recorte: territory.level,
      periodo: period,
      camadas: selectedAvailableLayers.join(","),
    });
    const params = new URLSearchParams({ locationKey: territory.locationKey, period, layers: selectedAvailableLayers.join(",") });
    params.set("section", "communication");
    startGenerating(() => router.push(`/${locale}/platform?${params.toString()}`));
  }

  return (
    <section className="h-full w-full overflow-y-auto bg-[#F6F7F6] px-4 py-12 text-[#292829]">
      <form onSubmit={handleSubmit} className="mx-auto flex min-h-full w-full max-w-96 flex-col gap-6">
        <header className="space-y-2">
          <h2 className="font-inter text-2xl font-semibold leading-6 tracking-[-0.015em]">{t("section")}</h2>
          <p className="font-inter text-base font-medium leading-6 tracking-[-0.015em]">{t("selectionDescription")}</p>
        </header>

        <fieldset className="space-y-3">
          <legend className="font-open-sans text-lg font-semibold leading-6">{t("selectArea")}</legend>
          <p className="font-inter text-xs font-medium leading-[18px] tracking-[-0.015em]">{t("selectAreaHint")}</p>
          <div className="flex w-full flex-col items-start gap-[6px]">
            <span id="municipal-report-scope-label" className="text-[14px] font-medium leading-[20px] text-[#292829]">{t("scope")}</span>
            {/* Recorte em cima, território embaixo: o segundo campo só faz sentido
                depois de escolher o primeiro, e empilhado ele cabe inteiro. */}
            <div className="flex w-full flex-col gap-2">
              <PanelDropdown
                labelledBy="municipal-report-scope-label"
                ariaLabelPrefix={t("scope")}
                options={REPORT_SCOPE_OPTIONS.map((option) => ({ value: option, label: t(`scopes.${option}`) }))}
                value={scope}
                placeholder={t("scope")}
                onChange={(value) => selectScope(value as ReportScope)}
              />
              {scope !== "municipality" && scope !== "national" && (
                <PanelDropdown
                  labelledBy="municipal-report-scope-label"
                  ariaLabelPrefix={t(`scopes.${scope}`)}
                  options={SPATIAL_VALUE_OPTIONS[scope].map((option) => ({ value: option.value, label: tAnalysis(option.labelKey) }))}
                  value={spatialValue}
                  placeholder={t("selectTerritory")}
                  onChange={selectSpatialValue}
                />
              )}
            <div ref={municipalityPickerRef} className={`relative min-w-0 flex-1 ${scope === "municipality" ? "" : "hidden"}`}>
              <span className="sr-only">{t("municipality")}</span>
              <div className="flex h-10 w-full items-center overflow-hidden rounded-lg border border-transparent bg-[#E4E5E2] px-3 py-3 shadow-sm transition hover:border-neutral-400 focus-within:border-neutral-600 focus-within:ring-2 focus-within:ring-neutral-600">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-2 h-4 w-4 shrink-0 text-[#898989]" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                <input
                  value={selectedMunicipality && municipalityQuery === "" ? selectedMunicipality.label : municipalityQuery}
                  onChange={(event) => {
                    setMunicipalityQuery(event.target.value);
                    setMunicipalityCode("");
                    setIsMunicipalityOptionsOpen(true);
                    resetAvailability();
                  }}
                  onFocus={() => setIsMunicipalityOptionsOpen(true)}
                  role="combobox"
                  aria-label={t("municipality")}
                  aria-autocomplete="list"
                  aria-controls="municipal-report-municipality-options"
                  aria-expanded={isMunicipalityOptionsOpen}
                  aria-haspopup="listbox"
                  className="min-w-0 flex-1 border-none bg-transparent p-0 text-[13px] leading-5 text-[#292829] outline-none ring-0 placeholder:text-[12px] placeholder:text-[#292829]"
                  placeholder={t("searchMunicipality")}
                />
                {(municipalityQuery || municipalityCode) && (
                  <button type="button" onClick={clearMunicipalityQuery} className="ml-2 shrink-0 rounded text-[#898989] hover:text-[#292829]" aria-label={t("selectMunicipality")}>
                    ×
                  </button>
                )}
                <button type="button" onClick={() => setIsMunicipalityOptionsOpen((current) => !current)} className="ml-2 shrink-0 text-[#898989]" aria-label={t("selectMunicipality")}>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform ${isMunicipalityOptionsOpen ? "rotate-180" : ""}`} aria-hidden="true">
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              {isMunicipalityOptionsOpen && (
                <div id="municipal-report-municipality-options" role="listbox" className="absolute top-[calc(100%+8px)] z-30 max-h-64 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
                  {filteredMunicipalities.length > 0 ? filteredMunicipalities.map((municipality) => (
                    <button
                      key={municipality.code}
                      type="button"
                      role="option"
                      aria-selected={municipalityCode === municipality.code}
                      onClick={() => selectMunicipality(municipality.code, municipality.label)}
                      className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-[#292829] transition hover:bg-[#F6F7F6]"
                    >
                      {municipality.label}
                    </button>
                  )) : (
                    <div className="px-3 py-2 text-sm text-neutral-500">{t("noMunicipalityResults")}</div>
                  )}
                </div>
              )}
            </div>
            </div>
            {/* Seletor de data temporariamente desativado. O período padrão do relatório é 2026.
            <label className="flex w-full max-w-[392px] flex-col items-start gap-[6px]">
              <span className="text-[14px] font-medium leading-[20px] text-[#292829]">{t("analysisDate")}</span>
              <span ref={periodPickerRef} className="relative w-full">
                <button
                  type="button"
                  onClick={() => setIsPeriodOptionsOpen((current) => !current)}
                  className="flex h-10 w-full items-center justify-between rounded-lg border border-transparent bg-[#E4E5E2] px-3 py-3 text-left shadow-sm transition hover:border-neutral-400 focus-visible:border-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-600"
                  aria-haspopup="listbox"
                  aria-expanded={isPeriodOptionsOpen}
                  aria-controls="municipal-report-period-options"
                >
                  <span className="truncate text-sm text-[#292829]">{period}</span>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={`ml-2 shrink-0 text-[#898989] transition-transform ${isPeriodOptionsOpen ? "rotate-180" : ""}`} aria-hidden="true">
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {isPeriodOptionsOpen && (
                  <div id="municipal-report-period-options" role="listbox" className="absolute top-[calc(100%+8px)] z-20 max-h-64 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
                    {periodOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="option"
                        aria-selected={period === option}
                        onClick={() => {
                          setPeriod(option);
                          setIsPeriodOptionsOpen(false);
                          setSelectedLayers(
                            municipalityCode ? getDefaultSelectedLayers(municipalityCode, option) : new Set(),
                          );
                        }}
                        className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-[#292829] transition hover:bg-[#F6F7F6]"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </span>
            </label>
            */}
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
            <div className="flex min-h-[18px] items-center gap-2 font-inter text-xs leading-[18px] text-[#7E797B]" aria-live="polite">
              {availabilityState === "idle" && t("availabilityIdle")}
              {availabilityState === "ready" && availableLayers.length === 0 && t("noModulesAvailable")}
            </div>
          </div>

          <div className="space-y-4">
            {groups.map((group, index) => (
              <LayerAccordion key={group.key} title={translatedCategoryTitle(group)} defaultOpen={false}>
                <div className="flex flex-col gap-2">
                  {group.items.map(renderLayerOption)}
                  {group.subgroups.map((subgroup) => (
                    <LayerAccordion key={subgroup.key} title={tModules(`subgroups.${subgroup.key}`)} defaultOpen={false}>
                      <div className="flex flex-col gap-2">{subgroup.items.map(renderLayerOption)}</div>
                    </LayerAccordion>
                  ))}
                </div>
              </LayerAccordion>
            ))}
          </div>
        </fieldset>

        <button type="submit" disabled={!canSubmit || isGenerating} className="mt-auto flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded bg-[#989F43] px-4 font-open-sans text-sm text-white hover:bg-[#858c39] disabled:cursor-not-allowed disabled:opacity-70">{isGenerating && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}{isGenerating ? t("generatingReport") : t("generateReport")}</button>
      </form>
      {infoLayer && <InfoModal card={{ id: 0, title: infoLayer.name, description: infoLayer.description, image: infoLayer.previewMap?.url, fileRef: infoLayer.id, imageData: infoLayer.imageData, timeScale: infoLayer.timeScale }} imageData={infoLayer.imageData} open onClose={() => setInfoLayer(null)} />}
    </section>
  );
}
