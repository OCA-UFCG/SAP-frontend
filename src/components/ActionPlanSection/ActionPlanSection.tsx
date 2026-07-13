import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import { ActionPlanSectionI } from "@/utils/interfaces";
import { Card } from "@/components/Card/Card";
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

  const title = t("title", { title: content.title });
  const text = t.has("text")
    ? t("text")
    : documentToReactComponents(content.text.json);

  return (
    <section
      id={id}
      className={`w-full scroll-mt-16.5 flex flex-col items-center ${className}`}
    >
      <div className="w-full max-w-[1440px] mx-auto px-4 py-16 md:px-10 lg:px-[80px] flex flex-col gap-6">
        <h2 className="text-[28px] md:text-[36px] lg:text-[42px] leading-tight font-bold text-[#21240F] text-left">
          {title}
        </h2>

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
      </div>
    </section>
  );
};

export default ActionPlanSection;
