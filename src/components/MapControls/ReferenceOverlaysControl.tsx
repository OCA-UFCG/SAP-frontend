"use client";

import { useId, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/Icon/Icon";
import {
  REFERENCE_LAYER_IDS,
  REFERENCE_LAYER_SWATCHES,
  type ReferenceLayerId,
} from "@/components/MapLayerContext/mapLayerState";
import { MapControlDisclosure } from "./MapControlCard";
import type { ReferenceTerritory } from "./referenceTerritories";
import { SelectedTerritory, TerritorySearch } from "./TerritorySearch";

interface ReferenceOverlaysControlProps {
  activeOverlays: ReadonlySet<ReferenceLayerId>;
  onToggle: (layerId: ReferenceLayerId) => void;
  highlightedOverlay: ReferenceLayerId | null;
  onToggleHighlight: (layerId: ReferenceLayerId) => void;
  onSelectTerritory: (territory: ReferenceTerritory) => void;
  selectedTerritory?: ReferenceTerritory | null;
  onClearTerritory?: () => void;
  onOpen?: () => void;
}

export function ReferenceOverlaysControl({
  activeOverlays,
  onToggle,
  highlightedOverlay,
  onToggleHighlight,
  onSelectTerritory,
  selectedTerritory,
  onClearTerritory,
  onOpen,
}: ReferenceOverlaysControlProps) {
  const t = useTranslations("PlatformMap");

  return (
    <MapControlDisclosure
      label={t("referenceOverlays")}
      onOpen={onOpen}
      animated
      summary={
        selectedTerritory &&
        onClearTerritory && (
          <SelectedTerritory
            territory={selectedTerritory}
            onFocus={onSelectTerritory}
            onClear={onClearTerritory}
          />
        )
      }
    >
      {() => (
        <div data-cascade className="flex flex-col gap-3 pt-1">
          <h3 className="font-open-sans text-sm leading-5 text-[#292829]">
            {t("referenceLayersTitle")}
          </h3>
          <div className="flex flex-col gap-2">
            <TerritorySearch
              activeOverlays={activeOverlays}
              onSelect={onSelectTerritory}
            />
            <p className="font-open-sans text-xs leading-[18px] text-[#292829]">
              {t("territorySearchHint")}
            </p>
          </div>
          <ul className="flex flex-col gap-4 pt-1">
            {REFERENCE_LAYER_IDS.map((layerId) => (
              <ReferenceLayerRow
                key={layerId}
                layerId={layerId}
                visible={activeOverlays.has(layerId)}
                highlighted={highlightedOverlay === layerId}
                onToggle={onToggle}
                onToggleHighlight={onToggleHighlight}
              />
            ))}
          </ul>
        </div>
      )}
    </MapControlDisclosure>
  );
}

function ReferenceLayerRow({
  layerId,
  visible,
  highlighted,
  onToggle,
  onToggleHighlight,
}: {
  layerId: ReferenceLayerId;
  visible: boolean;
  highlighted: boolean;
  onToggle: (layerId: ReferenceLayerId) => void;
  onToggleHighlight: (layerId: ReferenceLayerId) => void;
}) {
  const t = useTranslations("PlatformMap");
  const labelId = useId();
  const name = t(layerId);
  const highlightLabel = t("highlightTerritory", { name });

  return (
    <li
      className="flex items-center gap-3"
      style={
        { "--swatch": REFERENCE_LAYER_SWATCHES[layerId].fill } as CSSProperties
      }
    >
      <span
        aria-hidden="true"
        className="size-3.5 shrink-0 rounded-full bg-(--swatch)"
      />
      <span
        id={labelId}
        className="min-w-0 flex-1 font-open-sans text-xs font-semibold leading-[15px] text-[#292829]"
      >
        {name}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={visible}
        aria-labelledby={labelId}
        onClick={() => onToggle(layerId)}
        className={`relative h-[22px] w-[42px] shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--swatch) ${
          visible ? "bg-(--swatch)" : "bg-[#D4D5D1]"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute left-0.5 top-0.5 size-[18px] rounded-full bg-white shadow-sm transition-transform duration-150 ${
            visible ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <button
        type="button"
        aria-pressed={highlighted}
        aria-label={highlightLabel}
        title={highlightLabel}
        onClick={() => onToggleHighlight(layerId)}
        className={`flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#5B612A] ${
          highlighted
            ? "border-[#5B612A] bg-[#F1F2EC] text-[#5B612A]"
            : "border-[#E4E4E4] bg-white text-[#8B8F52] hover:bg-[#F5F6EE]"
        }`}
      >
        <Icon id="crosshair" size={16} />
      </button>
    </li>
  );
}
