"use client";

import { useTranslations } from "next-intl";
import { PanelDropdown } from "@/components/PanelDropdown/PanelDropdown";
import {
  getDefaultSpatialValue,
  resolveSpatialSelection,
  SPATIAL_AREA_OPTIONS,
  SPATIAL_VALUE_OPTIONS,
  type SpatialArea,
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

  const valueOptions = SPATIAL_VALUE_OPTIONS[spatialSelection.spatialArea];
  const selectedValue =
    valueOptions.find(
      (option) => option.value === spatialSelection.spatialValue,
    ) ?? valueOptions[0];

  const selectArea = (spatialArea: string) => {
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
    <div className="flex w-full max-w-[392px] gap-4">
      <PanelDropdown
        label={t("areaLabel")}
        options={SPATIAL_AREA_OPTIONS.map((area) => ({
          value: area.value,
          label: t(area.labelKey),
        }))}
        value={spatialSelection.spatialArea}
        placeholder={t("selectArea")}
        onChange={selectArea}
      />
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
    </div>
  );
}
