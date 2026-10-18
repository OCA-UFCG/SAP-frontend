"use client";

import clsx from "clsx";
import { useId } from "react";
import { useTranslations } from "next-intl";
import {
  FORECAST_DIMENSIONS,
  getForecastFilterOptions,
  resolveForecastSelection,
  type ForecastDimension,
  type ForecastMember,
} from "@/utils/forecastGroup";

interface ForecastFiltersProps {
  members: readonly ForecastMember[];
  current: ForecastMember;
  onSelect: (member: ForecastMember) => void;
}

/**
 * Os filtros do cartão "Previsão climática": cada combinação de fonte,
 * variável, periodicidade e tipo é uma camada, e escolher uma opção troca a
 * camada do mapa. Uma opção sem camada para o que está escolhido acima dela
 * aparece apagada, para a pessoa saber que ela existe em outra combinação.
 */
export function ForecastFilters({
  members,
  current,
  onSelect,
}: ForecastFiltersProps) {
  const t = useTranslations("AnalysisPanel.forecastFilters");
  const idPrefix = useId();
  const options = getForecastFilterOptions(members, current);

  const optionLabel = (dimension: ForecastDimension, value: string) =>
    dimension === "periodicity" ? t(`periodicities.${value}`) : value;

  const handleSelect = (dimension: ForecastDimension, value: string) => {
    const next = resolveForecastSelection(members, {
      ...current,
      [dimension]: value,
    });
    if (next && next.layer.id !== current.layer.id) onSelect(next);
  };

  return (
    <div className="flex w-full max-w-[392px] flex-col gap-4">
      {FORECAST_DIMENSIONS.map((dimension) => {
        const labelId = `${idPrefix}-${dimension}`;
        return (
          <div key={dimension} className="flex flex-col items-start gap-[6px]">
            <span
              id={labelId}
              className="text-[14px] font-medium leading-[20px] text-[#292829]"
            >
              {t(`dimensions.${dimension}`)}
            </span>
            <div
              role="radiogroup"
              aria-labelledby={labelId}
              className="flex h-10 w-full gap-1 rounded-lg bg-[#E4E5E2] p-1 shadow-sm"
            >
              {options[dimension].map((option) => {
                const label = optionLabel(dimension, option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={option.selected}
                    disabled={!option.enabled}
                    title={option.enabled ? label : t("unavailable", { label })}
                    onClick={() => handleSelect(dimension, option.value)}
                    className={clsx(
                      "min-w-0 flex-1 truncate rounded-md px-2 text-sm transition-colors duration-150",
                      "focus-visible:ring-2 focus-visible:ring-[#989F43] focus-visible:outline-none",
                      option.selected
                        ? "bg-[#989F43] font-medium text-white"
                        : option.enabled
                          ? "cursor-pointer text-[#292829] hover:bg-[#F0F0D7]"
                          : "cursor-not-allowed text-[#A9A6A7]",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
