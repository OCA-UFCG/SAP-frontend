import { Fragment } from "react";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import { ActionPlanSectionI } from "@/utils/interfaces";
import { ThematicAxisCard } from "@/components/ActionPlanSection/ThematicAxisCard";
import { TargetIcon } from "@/components/HomeIcons/HomeIcons";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  content: ActionPlanSectionI;
  className?: string;
};

// Ícones do Material dos números do plano, na ordem de `content.stats`.
const statIcon = (path: string) => {
  const StatIcon = () => (
    <svg width={36} height={36} viewBox="0 0 24 24" fill="#5B612A" aria-hidden>
      <path d={path} />
    </svg>
  );
  return StatIcon;
};

const STAT_ICONS = [
  statIcon(
    "M9 17l3-2.94c-.39-.04-.68-.06-1-.06-2.67 0-8 1.34-8 4v2h9l-3-3zm2-5c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4m4.47 8.5L12 17l1.4-1.41 2.07 2.08 5.13-5.17 1.4 1.41-6.53 6.59z",
  ),
  () => <TargetIcon size={36} className="text-[#5B612A]" />,
  statIcon("M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"),
  statIcon(
    "M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12zM10 9h8v2h-8zm0 3h4v2h-4zm0-6h8v2h-8z",
  ),
  statIcon(
    "M6.5 10h-2v7h2v-7zm6 0h-2v7h2v-7zm8.5 9H2v2h19v-2zm-2.5-9h-2v7h2v-7zm-7-6.74L16.71 6H6.29l5.21-2.74m0-2.26L2 6v2h19V6l-9.5-5z",
  ),
  statIcon(
    "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 2.88-2.88 7.19-5 9.88C9.92 16.21 7 11.85 7 9zm5 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  ),
];

/** "O PAB-Brasil": o texto do plano e a faixa com os números dele. */
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

  const statValue = (index: number, fallback: string) =>
    t.has(`stats.${index}.value`) ? t(`stats.${index}.value`) : fallback;
  const statLabel = (index: number, fallback: string) =>
    t.has(`stats.${index}.label`) ? t(`stats.${index}.label`) : fallback;

  return (
    <section
      id={id}
      className={cn(
        "w-full scroll-mt-16.5 flex flex-col items-center",
        className,
      )}
    >
      <div className="w-full max-w-[1440px] mx-auto px-4 py-12 md:px-10 lg:px-[80px] flex flex-col gap-8">
        <div className="flex flex-col items-start gap-4">
          <h2 className="pb-2 font-open-sans text-[1.5rem] md:text-[1.75rem] lg:text-[1.875rem] leading-[28px] md:leading-[32px] lg:leading-[36px] tracking-[-0.0075em] font-semibold text-[#292829] text-left">
            {title}
          </h2>
          <div className="font-inter text-[0.9375rem] md:text-[1rem] leading-[150%] text-[#292829] text-left">
            {text}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-[14px] rounded-lg bg-[#F8F7ED] p-6 sm:grid-cols-3 lg:flex lg:items-center">
          {content.stats.map((stat, index) => {
            const StatIcon = STAT_ICONS[index];

            return (
              <Fragment key={`${stat.label}-${index}`}>
                {index > 0 && (
                  <span
                    aria-hidden
                    className="hidden h-[76px] w-px shrink-0 bg-[#989F43] lg:block"
                  />
                )}
                <div className="flex flex-col gap-1 px-2 py-4 font-open-sans lg:flex-1">
                  {StatIcon && <StatIcon />}
                  <span className="text-[2rem] font-extrabold leading-[44px] text-[#777E32]">
                    {statValue(index, stat.value)}
                  </span>
                  <span className="text-base leading-[22px] text-[#3F4324]">
                    {statLabel(index, stat.label)}
                  </span>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/** Os cinco eixos do plano, com o do SEDES em destaque à esquerda. */
export const ThematicAxesSection = ({
  id,
  content,
  className = "bg-white",
}: Props) => {
  const t = useTranslations("ActionPlanSection");

  const axesTitle = t("axesSection.title", { title: content.axesTitle });

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
        <h2 className="pb-2 font-open-sans text-[1.5rem] md:text-[1.75rem] lg:text-[1.875rem] leading-[28px] md:leading-[32px] lg:leading-[36px] tracking-[-0.0075em] font-semibold text-[#292829] text-left">
          {axesTitle}
        </h2>

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
