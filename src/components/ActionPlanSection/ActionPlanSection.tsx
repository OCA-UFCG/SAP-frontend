import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import { ActionPlanSectionI } from "@/utils/interfaces";
import { Card } from "@/components/Card/Card";
import { getOddItemCenteringClassName } from "@/utils/functions";
import { useTranslations } from "next-intl";

type Props = {
  id?: string;
  content: ActionPlanSectionI;
  className?: string;
};

export const ActionPlanSection = ({
  id,
  content,
  className = "bg-white",
}: Props) => {
  const t = useTranslations("ActionPlanSection");
  const footerT = useTranslations("Footer");

  const title = t("title", { title: content.title });
  const text = t.has("text")
    ? t("text")
    : documentToReactComponents(content.text.json);
  const axesTitle = t("axesSection.title", { title: content.axesTitle });

  return (
    <section
      id={id}
      className={`w-full scroll-mt-16.5 flex flex-col items-center ${className}`}
    >
      <div className="w-full max-w-[1440px] mx-auto px-4 py-16 md:px-10 lg:px-[80px] flex flex-col gap-6">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#989F43] md:text-sm">
            {footerT("aboutMenu.planoDeAcaoBrasileiro")}
          </p>
          <h2 className="text-[28px] md:text-[36px] lg:text-[42px] leading-tight font-bold text-[#21240F] text-left">
            {title}
          </h2>
        </div>

        <div className="text-[15px] md:text-[16px] leading-[150%] text-[#292829] text-left">
          {text}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6">
          {content.stats.map((stat, index) => {
            const value = t.has(`stats.${index}.value`)
              ? t(`stats.${index}.value`)
              : stat.value;
            const label = t.has(`stats.${index}.label`)
              ? t(`stats.${index}.label`)
              : stat.label;

            return (
              <Card
                key={`${stat.label}-${index}`}
                hoverScale
                className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center"
              >
                <span className="text-3xl md:text-4xl font-bold text-[#21240F]">
                  {value}
                </span>
                <span className="text-sm text-[#3F4324]">{label}</span>
              </Card>
            );
          })}
        </div>

        <h3 className="mt-6 text-[22px] md:text-[26px] lg:text-[30px] font-bold text-[#21240F] text-left">
          {axesTitle}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
          {content.axes.map((axis, index) => {
            const axisTitle = t.has(`axesSection.axes.${index}.title`)
              ? t(`axesSection.axes.${index}.title`)
              : axis.title;
            const executor = t.has(`axesSection.axes.${index}.executor`)
              ? t(`axesSection.axes.${index}.executor`)
              : axis.executor;
            const partners = axis.partners.join(" · ");

            return (
              <Card
                key={`${axis.title}-${index}`}
                highlighted={axis.isSedesAxis}
                title={axis.isSedesAxis ? t("axesSection.sedesHere") : undefined}
                className={`flex flex-col p-5 text-left ${getOddItemCenteringClassName(index, content.axes.length)}`}
              >
                <h4 className="min-h-11 text-[15px] font-bold leading-snug text-[#21240F]">
                  {axisTitle}
                </h4>

                <div className="mt-4 flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8B5E34]">
                    {t("axesSection.executorLabel")}
                  </span>
                  <span className="text-sm text-[#292829]">
                    {executor} ({axis.executorActionsCount} {t("axesSection.actionsSuffix")})
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8B5E34]">
                    {t("axesSection.partnersLabel")}
                  </span>
                  <span className="text-sm text-[#292829]">{partners}</span>
                </div>

                <div className="mt-auto flex flex-col gap-1 border-t border-[#E4E5E2] pt-3">
                  <span className="text-lg font-bold text-[#21240F]">
                    {axis.actionsCount} {t("axesSection.actionsSuffix")}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ActionPlanSection;
