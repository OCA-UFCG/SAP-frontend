import { useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import InputForm from "./InputForm";
import {
  AnalyzeFormData,
  AnalyzeFormProps,
  AnalyzePayload,
  AnalysisLevel,
  interestArea,
} from "@/utils/amfeInterfaces";
import { ButtonUi } from "@/components/ButtonUI/ButtonUI";
import {
  interestAreas,
  interestAreaOptionsByLevel,
  rankingLevelsByInterestArea,
  text,
} from "@/utils/amfeConsts";
import ErrorMessage from "./ErrorMessage";
import SegmentedSlider from "./SegmentedSlider";
import { LayerAccordion } from "@/components/LayerAccordion/LayerAccordion";
import useCriterias from "@/components/Amfe/useCriterias";

const sectionClass = "mt-8";
const sectionHeaderClass = "mb-4";
const sectionTitleClass =
  "flex items-center gap-3 text-xl font-semibold tracking-tight";
const sectionMarkerClass = "h-6 w-1 rounded-full bg-[#989F43]";
const sectionDescriptionClass = "mt-2 text-sm leading-6 opacity-75";
const inputGroupCardClass =
  "mt-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]";
const selectClass =
  "w-full cursor-pointer rounded-xl border border-neutral-200 bg-white px-5 py-4 font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition-colors focus:border-[#989F43] focus:outline-none focus:ring-2 focus:ring-[#989F43]/20";
const softSelectClass =
  "w-full cursor-pointer rounded-xl border border-neutral-200 bg-[#fbfbfa] px-5 py-4 font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-colors focus:border-[#989F43] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#989F43]/20";

const AnalyzeForm = ({ setFormPayload }: AnalyzeFormProps) => {
  const t = useTranslations("AnalyzeForm");
  const { criterias: availableCriterias } = useCriterias();
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

  // Os erros dos limiares e do cenário são desenhados dentro do acordeão: se
  // ele estiver fechado, o envio falha sem que a pessoa veja o motivo.
  const hasAdvancedSettingsError = Boolean(
    errors.indifference ||
    errors.preference ||
    errors.veto ||
    errors.typeScenario,
  );

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
    <>
      <div className="flex w-full justify-center p-4 md:p-6">
        <form
          style={{
            color: text,
          }}
          className="w-full max-w-4xl p-2 md:p-4"
          onSubmit={handleSubmit(onSubmit)}
        >
          <div>
            <h1
              className="text-[28px] leading-tight font-semibold tracking-tight"
              style={{ color: text }}
            >
              {t("title")}
            </h1>
            <p
              className="mt-2 text-sm leading-6 opacity-75"
              style={{ color: text }}
            >
              {t("description")}
            </p>
          </div>

          <section className={sectionClass}>
            <div className={sectionHeaderClass}>
              <h2 className={sectionTitleClass} style={{ color: text }}>
                <span className={sectionMarkerClass} />
                <span>{t("criteriasTitle")}</span>
              </h2>
              {errors.criteria?.root?.message && (
                <ErrorMessage>
                  {errors.criteria?.root?.message as string}
                </ErrorMessage>
              )}
              <p className={sectionDescriptionClass} style={{ color: text }}>
                {t("criteriasDesc")}
              </p>
            </div>
            <div>
              <SegmentedSlider
                fields={fields}
                control={control}
                setValue={setValue}
              />
            </div>
          </section>

          <section className={sectionClass}>
            <div className={sectionHeaderClass}>
              <h2 className={sectionTitleClass} style={{ color: text }}>
                <span className={sectionMarkerClass} />
                <span>{t("interestAreaTitle")}</span>
              </h2>
              <p className={sectionDescriptionClass} style={{ color: text }}>
                {t("interestAreaDesc")}
              </p>
            </div>
            <div className={inputGroupCardClass}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col">
                  <label
                    className="mb-2 text-sm font-bold"
                    style={{ color: text }}
                  >
                    {t("interestAreaFieldLabel")}
                  </label>
                  <Controller
                    name="interestArea"
                    control={control}
                    rules={{ required: t("interestAreaRequired") }}
                    render={({ field }) => (
                      <select
                        {...field}
                        className={softSelectClass}
                        style={{ color: text }}
                      >
                        {interestAreas.map((option) => (
                          <option key={option} value={option}>
                            {interestAreaLabels[option]}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                  {errors.interestArea && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.interestArea.message as string}
                    </p>
                  )}
                </div>

                <div className="flex flex-col">
                  <label
                    className="mb-2 text-sm font-bold"
                    style={{ color: text }}
                  >
                    {t("interestAreaValueTitle")}
                  </label>
                  <Controller
                    name="interestAreaValue"
                    control={control}
                    rules={{ required: t("interestAreaValueRequired") }}
                    render={({ field }) => (
                      <select
                        {...field}
                        className={softSelectClass}
                        style={{ color: text }}
                      >
                        {interestAreaValueOptions.map((option) => (
                          <option key={option} value={option}>
                            {t(
                              `interestAreaOptions.${selectedInterestArea}.${option}`,
                            )}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                  {errors.interestAreaValue && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.interestAreaValue.message as string}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className={sectionClass}>
            <div className={sectionHeaderClass}>
              <h2 className={sectionTitleClass} style={{ color: text }}>
                <span className={sectionMarkerClass} />
                <span>{t("analysisLevelTitle")}</span>
              </h2>
              <p className={sectionDescriptionClass} style={{ color: text }}>
                {t("analysisLevelDesc")}
              </p>
            </div>
            <Controller
              name="level"
              control={control}
              rules={{ required: t("levelRequired") }}
              render={({ field }) => (
                <div className="mt-3">
                  <select
                    {...field}
                    className={selectClass}
                    style={{ color: text }}
                  >
                    {availableRankings.map((option) => (
                      <option key={option} value={option}>
                        {rankingLevelLabels[option]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            />
            {errors.level && (
              <p className="mt-1 text-sm text-red-500">
                {errors.level.message as string}
              </p>
            )}
          </section>

          <div className={sectionClass}>
            <LayerAccordion
              title={t("advancedSettingsTitle")}
              open={advancedSettingsOpen || hasAdvancedSettingsError}
              onOpenChange={setAdvancedSettingsOpen}
            >
              <section>
                <div className={sectionHeaderClass}>
                  <h2 className={sectionTitleClass} style={{ color: text }}>
                    <span className={sectionMarkerClass} />
                    <span>{t("thresholdsTitle")}</span>
                  </h2>
                  <p
                    className={sectionDescriptionClass}
                    style={{ color: text }}
                  >
                    {t("thresholdsDesc")}
                  </p>
                </div>
                <div className={inputGroupCardClass}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                </div>
              </section>

              <section>
                <div className={sectionHeaderClass}>
                  <h2 className={sectionTitleClass} style={{ color: text }}>
                    <span className={sectionMarkerClass} />
                    <span>{t("scenariosTitle")}</span>
                  </h2>
                  <p
                    className={sectionDescriptionClass}
                    style={{ color: text }}
                  >
                    {t("scenariosDesc")}
                  </p>
                </div>
                <Controller
                  name="typeScenario"
                  control={control}
                  rules={{ required: t("scenarioRequired") }}
                  render={({ field }) => (
                    <div
                      className="grid grid-cols-1 gap-3 rounded-xl border bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:grid-cols-2"
                      style={{ borderColor: "rgba(0,0,0,0.08)" }}
                    >
                      {(["optimistic", "pessimistic"] as const).map(
                        (option) => (
                          <label
                            key={option}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 font-medium transition-colors ${
                              field.value === option
                                ? "bg-[#989F43]/10"
                                : "hover:bg-neutral-50"
                            }`}
                            style={{ color: text }}
                          >
                            <input
                              type="radio"
                              value={option}
                              checked={field.value === option}
                              onChange={() => field.onChange(option)}
                              className="sr-only"
                            />
                            <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#ccc]">
                              {field.value === option && (
                                <span className="block h-2.5 w-2.5 rounded-full bg-[#989F43]" />
                              )}
                            </span>
                            {option === "optimistic"
                              ? t("optimistic")
                              : t("pessimistic")}
                          </label>
                        ),
                      )}
                    </div>
                  )}
                />
                {errors.typeScenario && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.typeScenario.message as string}
                  </p>
                )}
              </section>
            </LayerAccordion>
          </div>

          <ButtonUi
            type="submit"
            label={t("submitButton")}
            styles="mt-8 flex w-full items-center justify-center gap-2 bg-[#989F43] text-white hover:bg-[#858C38] hover:text-white"
          />
        </form>
      </div>
    </>
  );
};

export default AnalyzeForm;
