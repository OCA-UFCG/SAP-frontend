import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CriteriaCardI,
  CriteriaFields,
  Criteria,
} from "@/utils/amfeInterfaces";
import { useWatch } from "react-hook-form";
import CriteriaModal, { InfoTooltip } from "../CriteriaModal/CriteriaModal";
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

// Cor do número dentro de cada faixa: escuro nas faixas claras, claro nas escuras.
const LABEL_COLORS = [
  "#292829",
  "#F8F7F8",
  "#292829",
  "#F8F7F8",
  "#F8F7F8",
  "#292829",
  "#292829",
  "#F8F7F8",
];

const SegmentedBar = ({ fields, control, setValue }: CriteriaCardI) => {
  const t = useTranslations("SegmentedSlider");
  const { criterias: availableCriterias } = useCriterias();
  const watchedCriteria = useWatch({ control, name: "criteria" });

  const [openInfo, setOpenInfo] = useState<string | null>(null);
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
    <div className="flex flex-col gap-6 rounded-lg border border-[#EFEFEF] bg-white p-4 shadow-sm">
      <div
        className="relative flex h-[60px] gap-px overflow-hidden rounded-lg"
        role="group"
        aria-label={t("ariaLabel")}
      >
        {fields.map((field, i) => {
          const color = COLORS[i % COLORS.length];
          const pct = percentages[i];

          if (pct === 0) return null;

          return (
            <div
              key={i}
              className="relative flex items-center justify-end p-2 transition-all duration-300"
              style={{
                width: `${pct}%`,
                background: color,
              }}
            >
              {pct > 10 && (
                <span
                  className="font-open-sans text-[10px] leading-6 font-semibold"
                  style={{ color: LABEL_COLORS[i % LABEL_COLORS.length] }}
                >
                  {pct.toFixed(0)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {fields.map((field, i) => {
          const metadata = metadataByName.get(field.name);
          const label = metadata?.label || field.name;

          return (
            <div key={i} className="flex min-w-0 items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <div
                  className="h-[14px] w-[14px] flex-shrink-0 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="min-w-0 font-open-sans text-xs leading-4 font-semibold break-normal whitespace-normal text-[#292829]">
                  {label}
                </span>
              </div>
              <InfoTooltip
                id={field.name}
                name={label}
                description={metadata?.description || undefined}
                open={openInfo === field.name}
                onToggle={(e) => {
                  e.stopPropagation();
                  setOpenInfo((current) =>
                    current === field.name ? null : field.name,
                  );
                }}
                onOpen={() => setOpenInfo(field.name)}
                onClose={() => setOpenInfo(null)}
                placement="above"
                align={i % 2 === 0 ? "left" : "right"}
              />
              <input
                type="number"
                step="1"
                min={MIN_CRITERIA_INPUT_VALUE}
                max={MAX_CRITERIA_INPUT_VALUE}
                className="h-9 w-20 shrink-0 rounded-md border border-[#CBD5E1] bg-white px-3 font-open-sans text-sm leading-5 font-normal text-slate-400 transition-colors outline-none focus:border-[#989F43]"
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
                  const normalizedValues =
                    normalizeCriteriaValues(numericValues);

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
            </div>
          );
        })}
      </div>

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
            className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-[#E4E5E2] px-4 py-2 font-open-sans text-sm leading-6 font-normal text-[#292829] transition-colors hover:bg-gray-50"
          >
            <Icon id="addIcon" size={20} className="m-0.5" />
            <span>{t("editButton")}</span>
          </button>
        )}
      </CriteriaModal>
    </div>
  );
};

export default SegmentedBar;
