import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CriteriaCardI,
  CriteriaFields,
  Criteria,
} from "@/utils/amfeInterfaces";
import { useWatch } from "react-hook-form";
import CriteriaModal from "../CriteriaModal/CriteriaModal";
import { Icon } from "@/components/Icon/Icon";
import useCriterias from "@/components/Amfe/useCriterias";
import {
  MAX_CRITERIA_INPUT_VALUE,
  MIN_CRITERIA_INPUT_VALUE,
  normalizeCriteriaInputValue,
  normalizeCriteriaValues,
  preserveCriteriaInputValues,
} from "@/utils/normalizeCriteriaValues";

const COLORS = [
  "#3EBCD2",
  "#933497",
  "#B4BA61",
  "#86620D",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
];

const SegmentedBar = ({ fields, control, setValue }: CriteriaCardI) => {
  const t = useTranslations("SegmentedSlider");
  const { criterias: availableCriterias } = useCriterias();
  const watchedCriteria = useWatch({ control, name: "criteria" });

  const [localInputs, setLocalInputs] = useState({
    criteriaNamesKey: "",
    values: [] as string[],
  });

  const criteriaNamesKey = (watchedCriteria || [])
    .map((c: CriteriaFields) => c?.name)
    .join(",");
  const localValues =
    localInputs.criteriaNamesKey === criteriaNamesKey
      ? localInputs.values
      : (watchedCriteria || []).map(() => String(MIN_CRITERIA_INPUT_VALUE));

  const rawValues: number[] = (watchedCriteria || []).map(
    (item: CriteriaFields) => {
      const val = parseFloat(String(item?.value));
      return isNaN(val) ? 0 : val;
    },
  );

  const total = rawValues.reduce((a, b) => a + b, 0);
  const percentages = rawValues.map((v) =>
    total > 0 ? (v / total) * 100 : 100 / fields.length,
  );
  const metadataByName = new Map(
    availableCriterias.map((criterion) => [criterion.name, criterion]),
  );

  if (fields.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative flex h-10 overflow-hidden rounded-lg"
        role="group"
        aria-label={t("ariaLabel")}
      >
        {fields.map((field, i) => {
          const color = COLORS[i % COLORS.length];
          const pct = percentages[i];

          if (pct === 0) return null;

          const isLastVisible =
            fields.findIndex((_, idx) => idx > i && percentages[idx] > 0) ===
            -1;

          return (
            <div
              key={i}
              className="relative flex items-center justify-end pr-3 transition-all duration-300"
              style={{
                width: `${pct}%`,
                background: color,
                borderRight: isLastVisible ? "none" : "2px solid white",
              }}
            >
              {pct > 10 && (
                <span className="font-inter text-xs font-semibold text-white drop-shadow-sm">
                  {pct.toFixed(0)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {fields.map((field, i) => (
        <label
          key={i}
          className="flex min-h-12 items-center gap-3 rounded-lg border border-[#EFEFEF] bg-white py-1 pr-1 pl-4"
        >
          <span
            aria-hidden="true"
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: COLORS[i % COLORS.length] }}
          />
          <span className="font-inter min-w-0 flex-1 text-base leading-6 font-semibold tracking-[-0.015em] break-words text-[#292829]">
            {metadataByName.get(field.name)?.label || field.name}
          </span>
          <input
            type="number"
            step="1"
            min={MIN_CRITERIA_INPUT_VALUE}
            max={MAX_CRITERIA_INPUT_VALUE}
            className="h-10 w-24 shrink-0 rounded-lg border border-transparent bg-[#E4E5E2] px-3 text-right text-sm text-[#292829] shadow-sm transition outline-none hover:border-neutral-400 focus-visible:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-600"
            value={localValues[i] ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              const newLocalValues = [...localValues];
              newLocalValues[i] = raw;
              setLocalInputs({
                criteriaNamesKey,
                values: newLocalValues,
              });
            }}
            onBlur={() => {
              const clamped = String(
                normalizeCriteriaInputValue(localValues[i] ?? ""),
              );
              const newLocalValues = [...localValues];
              newLocalValues[i] = clamped;
              setLocalInputs({
                criteriaNamesKey,
                values: newLocalValues,
              });

              const numericValues = newLocalValues.map(
                (val) => parseFloat(val) || 0,
              );
              const normalizedValues = normalizeCriteriaValues(numericValues);

              normalizedValues.forEach((normalizedVal, idx) => {
                setValue(`criteria.${idx}.value`, normalizedVal, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        </label>
      ))}

      <CriteriaModal
        options={(availableCriterias || []).map((criterion) => ({
          id: criterion.name,
          name: criterion.label,
          description: criterion.description || undefined,
        }))}
        defaultSelected={fields.map((f) => f.name)}
        onApply={(ids: string[]) => {
          if (!ids || ids.length === 0) {
            setLocalInputs({ criteriaNamesKey: "", values: [] });
            setValue("criteria", [], {
              shouldDirty: true,
              shouldValidate: true,
            });
            return;
          }

          const preservedValues = preserveCriteriaInputValues(
            ids,
            (watchedCriteria || []).map(
              (criterion: CriteriaFields) => criterion.name,
            ),
            localValues,
          );
          const normalizedValues = normalizeCriteriaValues(
            preservedValues.map((value) => parseFloat(value) || 0),
          );
          setLocalInputs({
            criteriaNamesKey: ids.join(","),
            values: preservedValues,
          });
          const newCriteria: Criteria[] = ids.map((name, index) => {
            const metadata = metadataByName.get(name);
            return {
              name,
              value: normalizedValues[index],
              is_benefit: metadata?.is_benefit ?? true,
            };
          });
          setValue("criteria", newCriteria, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }}
      >
        {(openModal) => (
          <button
            type="button"
            onClick={openModal}
            aria-label={t("editButtonAria", { count: fields.length })}
            title={t("editButtonAria", { count: fields.length })}
            className="font-inter flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#EFEFEF] bg-white px-4 text-base font-medium text-[#0F172A] transition-colors duration-150 hover:bg-[#E4E5E2]"
          >
            <Icon id="addIcon" size={18} />
            <span>{t("editButton")}</span>
          </button>
        )}
      </CriteriaModal>
    </div>
  );
};

export default SegmentedBar;
