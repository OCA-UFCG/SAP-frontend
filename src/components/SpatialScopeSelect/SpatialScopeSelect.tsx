"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { PanelDropdown } from "@/components/PanelDropdown/PanelDropdown";
import { MunicipalitySearch } from "@/components/MunicipalitySearch/MunicipalitySearch";
import {
  DEFAULT_SPATIAL_SELECTION,
  getDefaultSpatialValue,
  resolveSpatialSelection,
  SPATIAL_AREA_OPTIONS,
  SPATIAL_VALUE_OPTIONS,
  type SpatialArea,
  type SpatialSelection,
} from "@/utils/spatialScope";

/** A Área "Município": não é um recorte do mapa, é a escolha de uma cidade. */
const MUNICIPALITY_AREA = "municipality";

export interface MunicipalityScope {
  /** O município escolhido, ou `null`. */
  code: string | null;
  onSelect: (municipalityCode: string, stateKey: string) => void;
  onClear: () => void;
}

export function SpatialScopeSelect({
  spatialSelection,
  onSpatialSelectionChange,
  municipality,
}: {
  spatialSelection: SpatialSelection;
  onSpatialSelectionChange: (value: SpatialSelection) => void;
  /** Com ele, "Município" vira uma Área e o Recorte vira uma busca. */
  municipality?: MunicipalityScope;
}) {
  const t = useTranslations("AnalysisPanel");
  const scopeLabelId = useId();
  // Escolher "Município" antes de escolher a cidade também conta: sem isso o
  // campo de busca sumiria até a pessoa digitar.
  const [municipalityChosen, setMunicipalityChosen] = useState(false);
  const isMunicipality = Boolean(
    municipality && (municipalityChosen || municipality.code),
  );

  const valueOptions = SPATIAL_VALUE_OPTIONS[spatialSelection.spatialArea];
  const selectedValue =
    valueOptions.find(
      (option) => option.value === spatialSelection.spatialValue,
    ) ?? valueOptions[0];

  const areaOptions = SPATIAL_AREA_OPTIONS.flatMap((area) => {
    const option = { value: area.value as string, label: t(area.labelKey) };
    // Entre Estado e Bioma: do maior para o menor, como a pessoa pensa.
    return municipality && area.value === "state"
      ? [
          option,
          {
            value: MUNICIPALITY_AREA,
            label: t("spatialAreas.municipality"),
          },
        ]
      : [option];
  });

  const selectArea = (spatialArea: string) => {
    if (spatialArea === MUNICIPALITY_AREA) {
      setMunicipalityChosen(true);
      // A cidade é vista sobre o Brasil inteiro, sem o corte de outro recorte.
      onSpatialSelectionChange(DEFAULT_SPATIAL_SELECTION);
      return;
    }
    setMunicipalityChosen(false);
    const area = spatialArea as SpatialArea;
    const selection = resolveSpatialSelection(
      area,
      getDefaultSpatialValue(area),
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
    // Grade e não flex: com a busca no lugar do Recorte, o flex espremia a
    // Área até sumir.
    <div className="grid w-full max-w-[392px] grid-cols-2 gap-4">
      <PanelDropdown
        label={t("areaLabel")}
        options={areaOptions}
        value={isMunicipality ? MUNICIPALITY_AREA : spatialSelection.spatialArea}
        placeholder={t("selectArea")}
        onChange={selectArea}
      />
      {isMunicipality && municipality ? (
        <div className="flex min-w-0 flex-col items-start gap-[6px]">
          <span
            id={scopeLabelId}
            className="text-[0.875rem] font-medium leading-[20px] text-[#292829]"
          >
            {t("scopeLabel")}
          </span>
          <MunicipalitySearch
            municipalityCode={municipality.code}
            onSelect={municipality.onSelect}
            onClear={municipality.onClear}
            labelledBy={scopeLabelId}
          />
        </div>
      ) : (
        <PanelDropdown
          label={t("scopeLabel")}
          options={valueOptions.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
          value={selectedValue?.value ?? ""}
          placeholder={t("selectValue")}
          onChange={selectValue}
        />
      )}
    </div>
  );
}
