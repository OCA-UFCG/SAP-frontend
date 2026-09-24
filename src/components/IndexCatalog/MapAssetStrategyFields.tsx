"use client";

import { useState } from "react";
import type { EarthEngineAssetMapping } from "@/types/indexCatalog";
import {
  detectYearPartitionedTemplate,
  fillYearPlaceholder,
} from "@/utils/indexCatalog";

/**
 * "year-siblings" não é uma estratégia do contrato: grava o mesmo `perPeriod`
 * com `{year}`. É a mesma opção que as estatísticas já oferecem, porque o IDT
 * foi publicado com `..._v4_2021` no template e o mapa ficou parado em 2021 —
 * o operador colou o endereço de um ano, como faz nas estatísticas.
 */
type MapAssetMode = "single" | "year-siblings" | "perPeriod";

const MAP_ASSET_FIELD_LABELS: Record<MapAssetMode, string> = {
  single: "ID do asset de mapa",
  "year-siblings": "ID do asset de mapa de um dos anos",
  perPeriod: "Template do asset de mapa",
};

const MAP_ASSET_PLACEHOLDERS: Record<MapAssetMode, string> = {
  single: "projects/projeto/assets/mapa",
  "year-siblings": "projects/projeto/assets/mapa_2026",
  perPeriod: "projects/projeto/assets/mapa_{period}",
};

// Sem dica no asset único: o formulário antigo não tinha, e o rótulo segue o mesmo.
const MAP_ASSET_HINTS: Record<MapAssetMode, string | null> = {
  single: null,
  "year-siblings":
    "Cole o endereço completo de um dos anos; o ano no fim do nome vira {year} e cada período usa o asset do seu ano.",
  perPeriod: "Templates aceitam {year}, {month} e {period}.",
};
function isYearOnlyTemplate(pattern?: string) {
  return Boolean(
    pattern?.includes("{year}") &&
    !pattern.includes("{month}") &&
    !pattern.includes("{period}"),
  );
}

/** A opção que um índice já salvo abre marcada, como nas estatísticas. */
function inferMapAssetMode(mapping: EarthEngineAssetMapping): MapAssetMode {
  if (mapping.strategy === "single") return "single";
  return isYearOnlyTemplate(mapping.assetPattern)
    ? "year-siblings"
    : "perPeriod";
}

interface MapAssetStrategyFieldsProps {
  mapping: EarthEngineAssetMapping;
  /** Ano do último período validado, para reexibir o endereço concreto. */
  latestYear?: string;
  inputClass: string;
  onChange: (values: Partial<EarthEngineAssetMapping>) => void;
}

/**
 * Organização e endereço do asset de mapa. Monte com `key` do índice aberto,
 * para a opção e o ano digitado recomeçarem a cada índice.
 *
 * <MapAssetStrategyFields key={entryId} mapping={draft.earthEngine} … />
 */
export function MapAssetStrategyFields({
  mapping,
  latestYear,
  inputClass,
  onChange,
}: MapAssetStrategyFieldsProps) {
  const [periodMode, setPeriodMode] = useState<MapAssetMode>(() =>
    inferMapAssetMode(mapping),
  );
  const [yearSample, setYearSample] = useState(() =>
    inferMapAssetMode(mapping) === "year-siblings" && latestYear
      ? fillYearPlaceholder(mapping.assetPattern ?? "", latestYear)
      : "",
  );
  // Outras partes do formulário (previsão, planilha) forçam "single" direto
  // no rascunho; o rascunho manda.
  const mode = mapping.strategy === "single" ? "single" : periodMode;

  function changeMode(nextMode: MapAssetMode) {
    setPeriodMode(nextMode);
    setYearSample("");
    if (nextMode === "single") {
      onChange({ strategy: "single" });
      return;
    }
    onChange({ strategy: "perPeriod", assetPattern: "" });
  }

  function changeAssetId(value: string) {
    if (mode === "single") {
      onChange({ singleAssetId: value });
      return;
    }
    if (mode === "perPeriod") {
      onChange({ assetPattern: value });
      return;
    }
    setYearSample(value);
    onChange({
      assetPattern:
        detectYearPartitionedTemplate(value)?.assetIdTemplate ?? value.trim(),
    });
  }

  const value =
    mode === "single"
      ? (mapping.singleAssetId ?? "")
      : mode === "perPeriod"
        ? (mapping.assetPattern ?? "")
        : yearSample;

  return (
    <>
      <label className="text-sm font-medium">
        Organização
        <select
          className={inputClass}
          value={mode}
          disabled={Boolean(mapping.collectionSelection)}
          onChange={(event) => changeMode(event.target.value as MapAssetMode)}
        >
          <option value="single">Asset único</option>
          <option value="year-siblings">
            Um asset por ano (detectar os anos)
          </option>
          <option value="perPeriod">Template por período</option>
        </select>
        {mapping.collectionSelection && (
          <span className="mt-1 block text-xs font-normal text-stone-500">
            Previsões por emissão usam uma única coleção.
          </span>
        )}
      </label>
      <label className="text-sm font-medium md:col-span-2">
        {MAP_ASSET_FIELD_LABELS[mode]}
        <input
          className={inputClass}
          placeholder={MAP_ASSET_PLACEHOLDERS[mode]}
          value={value}
          onChange={(event) => changeAssetId(event.target.value)}
        />
        {MAP_ASSET_HINTS[mode] && (
          <span className="mt-1 block text-xs font-normal text-stone-500">
            {MAP_ASSET_HINTS[mode]}
          </span>
        )}
        {mode === "year-siblings" && yearSample.trim() !== "" && (
          <YearDetectionNotice sample={yearSample} />
        )}
      </label>
    </>
  );
}

function YearDetectionNotice({ sample }: { sample: string }) {
  const detected = detectYearPartitionedTemplate(sample);
  return (
    <span
      className={`mt-2 block rounded-md px-3 py-2 text-xs font-normal ${
        detected ? "bg-[#F4F5D8] text-[#4B4E15]" : "bg-amber-50 text-amber-800"
      }`}
    >
      {detected
        ? `Ano ${detected.year} detectado. Cada período vai usar ${detected.assetIdTemplate}, com o ano do período no lugar de {year}.`
        : "Não encontramos um ano de 4 dígitos neste endereço. Inclua o ano (por exemplo, ..._2026) ou use “Template por período”."}
    </span>
  );
}
