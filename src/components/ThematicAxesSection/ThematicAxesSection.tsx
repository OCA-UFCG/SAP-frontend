import { ThematicAxesSectionI } from "@/utils/interfaces";
import { Card } from "@/components/Card/Card";
import { getOddItemCenteringClassName } from "@/utils/functions";
import { useTranslations } from "next-intl";

const SHOW_SAP_HERE_BADGE = false;

type Props = {
  content: ThematicAxesSectionI;
  className?: string;
};

export const ThematicAxesSection = ({
  content,
  className = "bg-white",
}: Props) => {
  const t = useTranslations("ThematicAxesSection");
  const title = t("title", { title: content.title });

  return (
    <section className={`w-full flex flex-col items-center ${className}`}>
      <div className="w-full max-w-[1440px] mx-auto px-4 pb-16 md:px-10 lg:px-[80px] flex flex-col gap-6">
        <h3 className="text-[22px] md:text-[26px] lg:text-[30px] font-bold text-[#21240F] text-left">
          {title}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
          {content.axes.map((axis, index) => {
            const axisTitle = t.has(`axes.${index}.title`)
              ? t(`axes.${index}.title`)
              : axis.title;
            const executor = t.has(`axes.${index}.executor`)
              ? t(`axes.${index}.executor`)
              : axis.executor;
            const partners = axis.partners.join(" · ");

            return (
              <Card
                key={`${axis.title}-${index}`}
                highlighted={axis.isSapAxis}
                className={`flex flex-col p-5 text-left ${getOddItemCenteringClassName(index, content.axes.length)}`}
              >
                <h4 className="min-h-11 text-[15px] font-bold leading-snug text-[#21240F]">
                  {axisTitle}
                </h4>

                <div className="mt-4 flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8B5E34]">
                    {t("executorLabel")}
                  </span>
                  <span className="text-sm text-[#292829]">
                    {executor} ({axis.executorActionsCount} {t("actionsSuffix")})
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8B5E34]">
                    {t("partnersLabel")}
                  </span>
                  <span className="text-sm text-[#292829]">{partners}</span>
                </div>

                <div className="mt-auto flex flex-col gap-1 border-t border-[#E4E5E2] pt-3">
                  <span className="text-lg font-bold text-[#21240F]">
                    {axis.actionsCount} {t("actionsSuffix")}
                  </span>
                  {SHOW_SAP_HERE_BADGE && axis.isSapAxis && (
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[#777E32]">
                      {t("sapHere")}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ThematicAxesSection;
