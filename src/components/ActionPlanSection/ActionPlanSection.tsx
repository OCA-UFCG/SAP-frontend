import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import { ActionPlanSectionI } from "@/utils/interfaces";
import { Badge } from "@/components/Badge/Badge";
import { ThematicAxisCard } from "@/components/ActionPlanSection/ThematicAxisCard";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

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
  const axesDescription = t("axesSection.description", {
    description: content.axesDescription,
  });

  const axisLabels = {
    sedesHere: t("axesSection.sedesHere"),
    actionsLabel: t("axesSection.actionsLabel"),
    executorLabel: t("axesSection.executorLabel"),
    partnersLabel: t("axesSection.partnersLabel"),
    actionsSuffix: t("axesSection.actionsSuffix"),
  };

  const sedesAxisIndex = content.axes.findIndex((axis) => axis.isSedesAxis);
  const otherAxes = content.axes
    .map((axis, index) => ({ axis, index }))
    .filter(({ axis }) => !axis.isSedesAxis);

  const statValue = (index: number, fallback: string) =>
    t.has(`stats.${index}.value`) ? t(`stats.${index}.value`) : fallback;
  const statLabel = (index: number, fallback: string) =>
    t.has(`stats.${index}.label`) ? t(`stats.${index}.label`) : fallback;

  const axisTitle = (index: number, fallback: string) =>
    t.has(`axesSection.axes.${index}.title`)
      ? t(`axesSection.axes.${index}.title`)
      : fallback;
  const axisDescription = (index: number, fallback?: string) =>
    t.has(`axesSection.axes.${index}.description`)
      ? t(`axesSection.axes.${index}.description`)
      : fallback;
  const axisExecutor = (index: number, fallback: string) =>
    t.has(`axesSection.axes.${index}.executor`)
      ? t(`axesSection.axes.${index}.executor`)
      : fallback;

  return (
    <section
      id={id}
      className={cn(
        "w-full scroll-mt-16.5 flex flex-col items-center",
        className,
      )}
    >
      <div className="w-full max-w-[1440px] mx-auto px-4 py-12 md:px-10 lg:px-[80px] flex flex-col gap-6">
        <div className="flex flex-col items-start gap-4">
          <Badge label={footerT("aboutMenu.planoDeAcaoBrasileiro")} />
          <h2 className="text-[24px] md:text-[28px] lg:text-[30px] leading-[28px] md:leading-[32px] lg:leading-[36px] tracking-[-0.0075em] font-semibold text-[#292829] text-left">
            {title}
          </h2>
          <div className="text-[15px] md:text-[16px] leading-[150%] text-[#292829] text-left">
            {text}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
          {content.stats.map((stat, index) => {
            const isFeatured = index === 0;

            return (
              <div
                key={`${stat.label}-${index}`}
                className={cn(
                  "flex flex-col justify-center p-4",
                  isFeatured && "lg:border-r lg:border-[#C8CAC5]",
                )}
              >
                <span
                  className={cn(
                    "font-extrabold leading-tight",
                    isFeatured
                      ? "text-[48px] lg:text-[64px] text-[#684B40]"
                      : "text-[28px] lg:text-4xl text-[#96755C]",
                  )}
                >
                  {statValue(index, stat.value)}
                </span>
                <span className="text-base text-[#292829] lg:whitespace-nowrap">
                  {statLabel(index, stat.label)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-[24px] md:text-[28px] lg:text-[30px] leading-[28px] md:leading-[32px] lg:leading-[36px] tracking-[-0.0075em] font-semibold text-[#292829] text-left">
            {axesTitle}
          </h3>
          <p className="text-base leading-normal text-[#292829]">
            {axesDescription}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[464fr_791fr]">
          {sedesAxisIndex >= 0 && (
            <ThematicAxisCard
              axis={content.axes[sedesAxisIndex]}
              title={axisTitle(
                sedesAxisIndex,
                content.axes[sedesAxisIndex].title,
              )}
              description={axisDescription(
                sedesAxisIndex,
                content.axes[sedesAxisIndex].description,
              )}
              executor={axisExecutor(
                sedesAxisIndex,
                content.axes[sedesAxisIndex].executor,
              )}
              labels={axisLabels}
            />
          )}

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {otherAxes.map(({ axis, index }) => (
              <ThematicAxisCard
                key={`${axis.title}-${index}`}
                axis={axis}
                title={axisTitle(index, axis.title)}
                description={axisDescription(index, axis.description)}
                executor={axisExecutor(index, axis.executor)}
                labels={axisLabels}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ActionPlanSection;
