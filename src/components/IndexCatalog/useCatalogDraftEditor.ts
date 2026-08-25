"use client";

import { useState } from "react";
import {
  EMPTY_DRAFT,
  type AssetLayout,
  type MapClassificationMode,
  type StandardPropertyKey,
} from "@/components/IndexCatalog/catalogDraftDefaults";
import type {
  ClassMapping,
  EarthEngineAssetMapping,
  EarthEngineSourceType,
  IndexCatalogConfigV2,
  IndexCatalogDraftInput,
} from "@/types/indexCatalog";
import {
  detectPeriodTemplate,
  toConcreteAssetSample,
} from "@/utils/indexCatalog";

type StatisticsAsset = IndexCatalogDraftInput["statisticsSource"]["asset"];

function readAssetAddress(asset: StatisticsAsset) {
  return asset.type === "fixed" ? asset.assetId : asset.assetIdTemplate;
}

/**
 * Traduz o endereço digitado para o asset que o contrato entende.
 *
 * No caminho principal o operador cola o endereço concreto de um período e a
 * detecção deriva o template. O valor cru só é gravado quando ele escolheu
 * escrever o template à mão ou quando a detecção não reconheceu período algum —
 * aí é melhor a validação reclamar do endereço real do que salvar um template
 * inventado.
 */
function toStatisticsAsset(
  layout: AssetLayout,
  manualTemplate: boolean,
  value: string,
): StatisticsAsset {
  if (layout === "single") return { type: "fixed", assetId: value };
  if (manualTemplate) {
    return { type: "period-template", assetIdTemplate: value };
  }
  return {
    type: "period-template",
    assetIdTemplate:
      detectPeriodTemplate(value)?.assetIdTemplate ?? value.trim(),
  };
}

/**
 * Como reexibir um asset por período ao reabrir um índice: endereço concreto
 * quando a detecção o traduz de volta para o mesmo template, e template cru
 * (modo manual) em qualquer outro caso.
 */
function resolveAddressMode(template: string | undefined, lastPeriod?: string) {
  const sample = template ? toConcreteAssetSample(template, lastPeriod) : null;
  return { sample: sample ?? "", manual: Boolean(template) && !sample };
}

function parseNumberList(value: string, label: string, integersOnly = false) {
  const numbers = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(Number);
  if (
    numbers.some(
      (number) =>
        !Number.isFinite(number) || (integersOnly && !Number.isInteger(number)),
    )
  ) {
    throw new Error(`${label} deve usar números separados por vírgula.`);
  }
  return numbers;
}

interface CatalogDraftEditorOptions {
  /** Usado para reexibir um template como o endereço concreto de um período. */
  lastValidatedPeriod?: string;
  /** Qualquer alteração invalida a prévia já mostrada na tela. */
  onDraftChange: () => void;
}

/**
 * Estado do formulário de cadastro do catálogo: o rascunho enviado para a API
 * mais o que existe apenas na tela — os endereços concretos digitados, a escolha
 * de escrever o template à mão e a forma de classificar o mapa.
 */
export function useCatalogDraftEditor({
  lastValidatedPeriod,
  onDraftChange,
}: CatalogDraftEditorOptions) {
  const [draft, setDraftState] = useState<IndexCatalogDraftInput>(EMPTY_DRAFT);
  const [statisticsSample, setStatisticsSample] = useState("");
  const [statisticsManualTemplate, setStatisticsManualTemplate] =
    useState(false);
  const [mapSample, setMapSample] = useState("");
  const [mapManualTemplate, setMapManualTemplate] = useState(false);
  const [classification, setClassification] =
    useState<MapClassificationMode>("pixel-codes");
  const [thresholdsInput, setThresholdsInput] = useState("");
  const [leadValuesInput, setLeadValuesInput] = useState("1, 2, 3, 4");

  /** Toda edição feita pelo operador invalida a prévia mostrada na tela. */
  function editDraft(
    update: (current: IndexCatalogDraftInput) => IndexCatalogDraftInput,
  ) {
    setDraftState(update);
    onDraftChange();
  }

  /**
   * Guarda o rascunho normalizado devolvido pelo salvamento. Não invalida a
   * prévia: é o mesmo conteúdo que acabou de ser enviado, não uma edição.
   */
  function setSavedDraft(input: IndexCatalogDraftInput) {
    setDraftState(input);
  }

  /**
   * Reaplica as classes inferidas na validação. Também não invalida a prévia —
   * ela é a origem desses valores.
   */
  function applyValidatedClasses(classes: ClassMapping[]) {
    setDraftState((current) => ({ ...current, classes }));
  }

  function updateDraft<K extends keyof IndexCatalogDraftInput>(
    key: K,
    value: IndexCatalogDraftInput[K],
  ) {
    editDraft((current) => ({ ...current, [key]: value }));
  }

  const statisticsLayout: AssetLayout =
    draft.statisticsSource.asset.type === "fixed" ? "single" : "per-period";
  const statisticsDetects =
    statisticsLayout === "per-period" && !statisticsManualTemplate;
  const mapLayout: AssetLayout =
    draft.earthEngine.strategy === "single" ? "single" : "per-period";
  const mapDetects = mapLayout === "per-period" && !mapManualTemplate;

  function changeStatisticsLayout(layout: AssetLayout) {
    setStatisticsSample("");
    setStatisticsManualTemplate(false);
    updateDraft("statisticsSource", {
      ...draft.statisticsSource,
      asset: toStatisticsAsset(layout, false, ""),
    });
  }

  function changeStatisticsAddress(value: string) {
    const detected = statisticsDetects ? detectPeriodTemplate(value) : null;
    if (statisticsDetects) setStatisticsSample(value);
    editDraft((current) => ({
      ...current,
      statisticsSource: {
        ...current.statisticsSource,
        asset: toStatisticsAsset(
          statisticsLayout,
          statisticsManualTemplate,
          value,
        ),
        // Um asset por mês só pode ser lido como fonte mensal: manter "Anual"
        // aqui produziria erro na leitura de cada período.
        ...(detected?.granularity === "month"
          ? { periodGranularity: "month" as const }
          : {}),
      },
    }));
  }

  function changeStatisticsManualTemplate(manual: boolean) {
    setStatisticsManualTemplate(manual);
    if (manual || statisticsSample.trim()) return;
    const asset = draft.statisticsSource.asset;
    setStatisticsSample(
      resolveAddressMode(
        asset.type === "period-template" ? asset.assetIdTemplate : undefined,
        lastValidatedPeriod,
      ).sample,
    );
  }

  function changeGranularity(periodGranularity: "year" | "month") {
    updateDraft("statisticsSource", {
      ...draft.statisticsSource,
      periodGranularity,
    });
  }

  function changeStatisticsProperty(key: StandardPropertyKey, value: string) {
    updateDraft("statisticsSource", {
      ...draft.statisticsSource,
      properties: { ...draft.statisticsSource.properties, [key]: value },
    });
  }

  function updateMap(values: Partial<EarthEngineAssetMapping>) {
    editDraft((current) => ({
      ...current,
      earthEngine: { ...current.earthEngine, ...values },
    }));
  }

  function changeMapLayout(layout: AssetLayout) {
    setMapSample("");
    setMapManualTemplate(false);
    updateMap(
      layout === "single"
        ? { strategy: "single", assetPattern: undefined }
        : { strategy: "perPeriod", singleAssetId: undefined },
    );
  }

  function changeMapAddress(value: string) {
    if (mapLayout === "single") {
      updateMap({ singleAssetId: value });
      return;
    }
    if (mapManualTemplate) {
      updateMap({ assetPattern: value });
      return;
    }
    setMapSample(value);
    updateMap({
      assetPattern:
        detectPeriodTemplate(value)?.assetIdTemplate ?? value.trim(),
    });
  }

  function changeMapManualTemplate(manual: boolean) {
    setMapManualTemplate(manual);
    if (manual || mapSample.trim()) return;
    setMapSample(
      resolveAddressMode(draft.earthEngine.assetPattern, lastValidatedPeriod)
        .sample,
    );
  }

  function changeMapSourceType(sourceType: EarthEngineSourceType) {
    // Faixas de valor classificam pixels; numa FeatureCollection a cor vem da
    // propriedade escolhida, então guardar limites ali só confundiria.
    if (sourceType === "featureCollection") {
      setThresholdsInput("");
      setClassification("pixel-codes");
    }
    updateMap({
      sourceType,
      ...(sourceType === "featureCollection" ? { thresholds: undefined } : {}),
      collectionSelection:
        sourceType === "imageCollection"
          ? draft.earthEngine.collectionSelection
          : undefined,
    });
  }

  function changeForecastEnabled(enabled: boolean) {
    if (!enabled) {
      updateMap({ collectionSelection: undefined });
      return;
    }
    // A banda de previsão é contínua: as classes saem das faixas de valor.
    setClassification("value-ranges");
    setLeadValuesInput("1, 2, 3, 4");
    setMapSample("");
    setMapManualTemplate(false);
    updateMap({
      strategy: "single",
      collectionSelection: {
        type: "latest-emission-leads",
        emissionProperty: "data_emissao",
        leadProperty: "lead_time",
        targetDateProperty: "system:time_start",
        leadValues: [1, 2, 3, 4],
      },
    });
  }

  function changeClassification(next: MapClassificationMode) {
    setClassification(next);
    if (next === "value-ranges") return;
    setThresholdsInput("");
    updateMap({ thresholds: undefined });
  }

  function changeClass(index: number, values: Partial<ClassMapping>) {
    editDraft((current) => ({
      ...current,
      classes: current.classes.map((entry, position) =>
        position === index ? { ...entry, ...values } : entry,
      ),
    }));
  }

  function reset() {
    setDraftState(structuredClone(EMPTY_DRAFT));
    setStatisticsSample("");
    setStatisticsManualTemplate(false);
    setMapSample("");
    setMapManualTemplate(false);
    setClassification("pixel-codes");
    setThresholdsInput("");
    setLeadValuesInput("1, 2, 3, 4");
  }

  function loadFromConfig(config: IndexCatalogConfigV2) {
    const lastPeriod = config.validation?.inferred.periods.at(-1);
    setDraftState({
      name: config.name,
      description: config.description,
      category: config.category,
      statisticsSource: config.statisticsSource,
      classes: config.classes,
      earthEngine: { ...config.earthEngine, assetsByPeriod: undefined },
    });
    const statistics = resolveAddressMode(
      config.statisticsSource.asset.type === "period-template"
        ? config.statisticsSource.asset.assetIdTemplate
        : undefined,
      lastPeriod,
    );
    setStatisticsSample(statistics.sample);
    setStatisticsManualTemplate(statistics.manual);
    const map = resolveAddressMode(
      config.earthEngine.strategy === "perPeriod"
        ? config.earthEngine.assetPattern
        : undefined,
      lastPeriod,
    );
    setMapSample(map.sample);
    setMapManualTemplate(map.manual);
    setClassification(
      config.earthEngine.thresholds?.length ? "value-ranges" : "pixel-codes",
    );
    setThresholdsInput(config.earthEngine.thresholds?.join(", ") ?? "");
    setLeadValuesInput(
      config.earthEngine.collectionSelection?.leadValues.join(", ") ??
        "1, 2, 3, 4",
    );
  }

  /** Rascunho pronto para a API: só o que o contrato aceita. */
  function normalizedDraft(): IndexCatalogDraftInput {
    const collectionSelection = draft.earthEngine.collectionSelection;
    const usesValueRanges =
      draft.earthEngine.sourceType !== "featureCollection" &&
      classification === "value-ranges" &&
      thresholdsInput.trim() !== "";
    return {
      ...draft,
      earthEngine: {
        ...draft.earthEngine,
        assetsByPeriod: undefined,
        thresholds: usesValueRanges
          ? parseNumberList(thresholdsInput, "Limites das faixas")
          : undefined,
        ...(collectionSelection
          ? {
              collectionSelection: {
                ...collectionSelection,
                leadValues: parseNumberList(
                  leadValuesInput,
                  "Horizontes",
                  true,
                ),
              },
            }
          : { collectionSelection: undefined }),
      },
    };
  }

  return {
    draft,
    setSavedDraft,
    applyValidatedClasses,
    updateDraft,
    reset,
    loadFromConfig,
    normalizedDraft,
    statistics: {
      layout: statisticsLayout,
      onLayoutChange: changeStatisticsLayout,
      address: statisticsDetects
        ? statisticsSample
        : readAssetAddress(draft.statisticsSource.asset),
      onAddressChange: changeStatisticsAddress,
      detection: statisticsDetects
        ? detectPeriodTemplate(statisticsSample)
        : null,
      manualTemplate: statisticsManualTemplate,
      onManualTemplateChange: changeStatisticsManualTemplate,
      onGranularityChange: changeGranularity,
      onPropertyChange: changeStatisticsProperty,
    },
    map: {
      mapping: draft.earthEngine,
      onMappingChange: updateMap,
      onSourceTypeChange: changeMapSourceType,
      onForecastEnabledChange: changeForecastEnabled,
      layout: mapLayout,
      onLayoutChange: changeMapLayout,
      address: mapDetects
        ? mapSample
        : mapLayout === "single"
          ? (draft.earthEngine.singleAssetId ?? "")
          : (draft.earthEngine.assetPattern ?? ""),
      onAddressChange: changeMapAddress,
      detection: mapDetects ? detectPeriodTemplate(mapSample) : null,
      manualTemplate: mapManualTemplate,
      onManualTemplateChange: changeMapManualTemplate,
      classification,
      onClassificationChange: changeClassification,
      thresholdsInput,
      onThresholdsInputChange: setThresholdsInput,
      leadValuesInput,
      onLeadValuesInputChange: setLeadValuesInput,
    },
    classes: {
      classes: draft.classes,
      onClassChange: changeClass,
    },
  };
}
