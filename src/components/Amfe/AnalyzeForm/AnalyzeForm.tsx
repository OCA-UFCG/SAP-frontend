import { useEffect, useRef, useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
} from "react-hook-form";
import { useTranslations } from "next-intl";
import InputForm from "./InputForm";
import {
  AnalyzeFormData,
  AnalyzeFormProps,
  AnalyzePayload,
  AnalysisLevel,
  interestArea,
} from "@/utils/amfeInterfaces";
import {
  interestAreas,
  interestAreaOptionsByLevel,
  rankingLevelsByInterestArea,
} from "@/utils/amfeConsts";
import ErrorMessage from "./ErrorMessage";
import SegmentedSlider from "./SegmentedSlider";
import { PanelDropdown } from "@/components/PanelDropdown/PanelDropdown";
import { LayerAccordion } from "@/components/LayerAccordion/LayerAccordion";
import useCriterias from "@/components/Amfe/useCriterias";

// Mesmos estilos do painel de Comunicação, para as três abas da plataforma
// falarem a mesma língua visual.
const titleClass =
  "font-inter text-2xl leading-6 font-semibold tracking-[-0.015em]";
const subtitleClass =
  "font-inter text-base leading-6 font-medium tracking-[-0.015em]";
const sectionClass = "space-y-3";
const legendClass = "font-open-sans text-lg leading-6 font-semibold";
const subLegendClass = "font-open-sans text-base leading-6 font-semibold";
const hintClass =
  "font-inter text-xs leading-[18px] font-medium tracking-[-0.015em]";

const AnalyzeForm = ({ setFormPayload }: AnalyzeFormProps) => {
  const t = useTranslations("AnalyzeForm");
  const { criterias: availableCriterias, error: criteriasError } =
    useCriterias();
  const hasInitializedCriterias = useRef(false);
  const {
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<AnalyzeFormData>({
    defaultValues: {
      criteria: [],
      typeScenario: "pessimistic",
      level: "state",
      interestAreaValue: interestAreaOptionsByLevel.state[0],
      interestArea: "state",
    },
  });

  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);

  const openAdvancedSettingsOnError = (
    submitErrors: FieldErrors<AnalyzeFormData>,
  ) => {
    if (
      submitErrors.indifference ||
      submitErrors.preference ||
      submitErrors.veto ||
      submitErrors.typeScenario
    ) {
      setAdvancedSettingsOpen(true);
    }
  };

  const selectedInterestArea = useWatch({ control, name: "interestArea" });
  const selectedLevel = useWatch({ control, name: "level" });

  const availableRankings = rankingLevelsByInterestArea[selectedInterestArea];
  const interestAreaValueOptions =
    interestAreaOptionsByLevel[selectedInterestArea] ??
    interestAreaOptionsByLevel.state;
  const interestAreaLabels: Record<interestArea, string> = {
    national: t("nacional"),
    state: t("estadual"),
    region: t("regional"),
    biome: t("bioma"),
    semiarid: t("semiarido"),
    asd: t("asdEntorno"),
  };
  const rankingLevelLabels: Record<AnalysisLevel, string> = {
    state: t("estadual"),
    region: t("regional"),
    biome: t("bioma"),
    national: t("todos"),
  };

  useEffect(() => {
    setValue("interestAreaValue", interestAreaValueOptions[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInterestArea, setValue]);

  useEffect(() => {
    if (!availableRankings.includes(selectedLevel)) {
      setValue("level", availableRankings[0] ?? "national");
    }
  }, [selectedInterestArea]);

  useEffect(() => {
    if (!hasInitializedCriterias.current && availableCriterias.length > 0) {
      hasInitializedCriterias.current = true;
      const configuredDefaults = availableCriterias.filter(
        (criterion) => criterion.default,
      );
      const initial = (
        configuredDefaults.length > 0 ? configuredDefaults : availableCriterias
      ).slice(0, 4);
      const per = Math.round((1 / initial.length) * 100) / 100;
      setValue(
        "criteria",
        initial.map((criterion) => ({
          name: criterion.name,
          value: per,
          is_benefit: criterion.is_benefit,
        })),
      );
    }
  }, [availableCriterias, setValue]);

  const { fields } = useFieldArray({
    control,
    name: "criteria",
    rules: {
      validate: (criteria) => {
        // Sem critério o backend recusa a análise com 422, e quem clicou não
        // via motivo nenhum: o aviso aparece aqui, antes de sair o pedido.
        if (criteria.length === 0) return t("criteriaRequired");

        const sum = criteria.reduce(
          (acc, el) => acc + Number(el.value),
          0,
        ) as number;

        return sum <= 1 || t("criteriaSumError");
      },
    },
  });

  const handleFormatData = (data: AnalyzeFormData): AnalyzePayload => {
    const {
      criteria,
      preference,
      veto,
      indifference,
      typeScenario,
      interestArea,
      interestAreaValue,
      level,
    } = data;

    return {
      criteria,
      thresholds: {
        preference,
        veto,
        indifference,
      },
      model: {
        version: "1.0",
      },
      typeScenario,
      ranking: {
        level,
      },
      interestArea: { type: interestArea, value: interestAreaValue },
    };
  };

  const onSubmit = (data: AnalyzeFormData) => {
    setFormPayload(handleFormatData(data));
  };

  return (
    <div className="min-h-full w-full px-6 py-12 text-[#292829]">
      <form
        className="flex w-full flex-col gap-6"
        onSubmit={handleSubmit(onSubmit, openAdvancedSettingsOnError)}
      >
        <header className="flex flex-col gap-2">
          <h2 className={titleClass}>{t("title")}</h2>
          <p className={subtitleClass}>{t("description")}</p>
        </header>

        <fieldset className={sectionClass}>
          <legend className={legendClass}>{t("criteriasTitle")}</legend>
          <p className={hintClass}>{t("criteriasDesc")}</p>
          {errors.criteria?.root?.message && (
            <ErrorMessage>
              {errors.criteria?.root?.message as string}
            </ErrorMessage>
          )}
          {criteriasError && (
            <ErrorMessage>{t("criteriaLoadError")}</ErrorMessage>
          )}
          <SegmentedSlider
            fields={fields}
            control={control}
            setValue={setValue}
          />
        </fieldset>

        <fieldset className={sectionClass}>
          <legend className={legendClass}>{t("interestAreaTitle")}</legend>
          <p className={hintClass}>{t("interestAreaDesc")}</p>
          <div className="flex w-full gap-2">
            <div className="flex min-w-0 flex-1 flex-col">
              <Controller
                name="interestArea"
                control={control}
                rules={{ required: t("interestAreaRequired") }}
                render={({ field }) => (
                  <PanelDropdown
                    label={t("interestAreaFieldLabel")}
                    options={interestAreas.map((option) => ({
                      value: option,
                      label: interestAreaLabels[option],
                    }))}
                    value={field.value}
                    placeholder={t("interestAreaFieldLabel")}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.interestArea && (
                <ErrorMessage>
                  {errors.interestArea.message as string}
                </ErrorMessage>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <Controller
                name="interestAreaValue"
                control={control}
                rules={{ required: t("interestAreaValueRequired") }}
                render={({ field }) => (
                  <PanelDropdown
                    label={t("interestAreaValueTitle")}
                    options={interestAreaValueOptions.map((option) => ({
                      value: option,
                      label: t(
                        `interestAreaOptions.${selectedInterestArea}.${option}`,
                      ),
                    }))}
                    value={field.value}
                    placeholder={t("interestAreaValueTitle")}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.interestAreaValue && (
                <ErrorMessage>
                  {errors.interestAreaValue.message as string}
                </ErrorMessage>
              )}
            </div>
          </div>
        </fieldset>

        <fieldset className={sectionClass}>
          <legend id="amfe-analysis-level-label" className={legendClass}>
            {t("analysisLevelTitle")}
          </legend>
          <p className={hintClass}>{t("analysisLevelDesc")}</p>
          <Controller
            name="level"
            control={control}
            rules={{ required: t("levelRequired") }}
            render={({ field }) => (
              <PanelDropdown
                labelledBy="amfe-analysis-level-label"
                ariaLabelPrefix={t("analysisLevelTitle")}
                options={availableRankings.map((option) => ({
                  value: option,
                  label: rankingLevelLabels[option],
                }))}
                value={field.value}
                placeholder={t("analysisLevelTitle")}
                onChange={field.onChange}
              />
            )}
          />
          {errors.level && (
            <ErrorMessage>{errors.level.message as string}</ErrorMessage>
          )}
        </fieldset>

        <LayerAccordion
          title={t("advancedSettingsTitle")}
          open={advancedSettingsOpen}
          onOpenChange={setAdvancedSettingsOpen}
        >
          <fieldset className={sectionClass}>
            <legend className={subLegendClass}>{t("thresholdsTitle")}</legend>
            <p className={hintClass}>{t("thresholdsDesc")}</p>
            <div className="flex flex-col gap-2">
              <InputForm
                error={errors.indifference?.message as string}
                fieldLabel={t("indifferenceLabel")}
                inputProps={{
                  placeholder: t("indifferencePlaceholder"),
                  type: "number",
                  step: 0.01,
                }}
                formProps={{
                  name: "indifference",
                  control: control,
                  rules: { required: t("indifferenceRequired") },
                  defaultValue: 0.02,
                }}
              />
              <InputForm
                error={errors.preference?.message as string}
                fieldLabel={t("preferenceLabel")}
                inputProps={{
                  placeholder: t("preferencePlaceholder"),
                  type: "number",
                  step: 0.1,
                }}
                formProps={{
                  name: "preference",
                  control: control,
                  rules: { required: t("preferenceRequired") },
                  defaultValue: 0.1,
                }}
              />
              <InputForm
                error={errors.veto?.message as string}
                fieldLabel={t("vetoLabel")}
                inputProps={{
                  placeholder: t("vetoPlaceholder"),
                  type: "number",
                  step: 0.1,
                }}
                formProps={{
                  name: "veto",
                  control: control,
                  rules: { required: t("vetoRequired") },
                  defaultValue: 0.5,
                }}
              />
            </div>
          </fieldset>

          <fieldset className={sectionClass}>
            <legend className={subLegendClass}>{t("scenariosTitle")}</legend>
            <p className={hintClass}>{t("scenariosDesc")}</p>
            <Controller
              name="typeScenario"
              control={control}
              rules={{ required: t("scenarioRequired") }}
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  {(["optimistic", "pessimistic"] as const).map((option) => (
                    <label
                      key={option}
                      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-[#EFEFEF] bg-white py-1 pl-4"
                    >
                      <input
                        type="radio"
                        name={field.name}
                        value={option}
                        checked={field.value === option}
                        onChange={() => field.onChange(option)}
                        className="h-3.5 w-3.5 shrink-0 accent-[#989F43]"
                      />
                      <span className="font-inter text-base leading-6 font-semibold tracking-[-0.015em]">
                        {option === "optimistic"
                          ? t("optimistic")
                          : t("pessimistic")}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            />
            {errors.typeScenario && (
              <ErrorMessage>
                {errors.typeScenario.message as string}
              </ErrorMessage>
            )}
          </fieldset>
        </LayerAccordion>

        {/* Até o catálogo chegar a lista de critérios está vazia; um clique
            nesse intervalo mandava a análise sem nenhum critério. */}
        <button
          type="submit"
          disabled={availableCriterias.length === 0}
          className="font-open-sans flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded bg-[#989F43] px-4 text-sm text-white hover:bg-[#858c39] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {t("submitButton")}
        </button>
      </form>
    </div>
  );
};

export default AnalyzeForm;
