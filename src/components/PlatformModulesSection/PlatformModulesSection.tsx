import { PlatformModulesSectionI } from "@/utils/interfaces";
import { Card } from "@/components/Card/Card";
import { useTranslations } from "next-intl";

const CIRCLE_COLORS = ["#989F43", "#4C7A5E", "#BF360C"];

type Props = {
  id?: string;
  content: PlatformModulesSectionI;
  className?: string;
};

export const PlatformModulesSection = ({
  id,
  content,
  className = "bg-white",
}: Props) => {
  const t = useTranslations("PlatformModulesSection");
  const title = t("title", { title: content.title });

  return (
    <section
      id={id}
      className={`w-full scroll-mt-16.5 flex flex-col items-center ${className}`}
    >
      <div className="w-full max-w-[1440px] mx-auto px-4 py-16 md:px-10 lg:px-[80px] flex flex-col gap-6">
        <h2 className="text-[28px] md:text-[36px] lg:text-[42px] leading-tight font-bold text-[#21240F]">
          {title}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {content.modules.map((module, index) => {
            const moduleTitle = t.has(`modules.${index}.title`)
              ? t(`modules.${index}.title`)
              : module.title;
            const description = t.has(`modules.${index}.description`)
              ? t(`modules.${index}.description`)
              : module.description;

            return (
              <Card
                key={`${module.title}-${index}`}
                className="flex flex-col gap-4 p-6 text-left"
              >
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white"
                  style={{
                    backgroundColor:
                      CIRCLE_COLORS[index % CIRCLE_COLORS.length],
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>

                <h3 className="text-[26px] font-bold text-[#21240F]">
                  {moduleTitle}
                </h3>

                <p className="text-sm leading-[150%] text-[#292829]">
                  {description}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PlatformModulesSection;
