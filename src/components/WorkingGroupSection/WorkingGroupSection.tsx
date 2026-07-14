import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import { WorkingGroupSectionI } from "@/utils/interfaces";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type Props = {
  id?: string;
  content: WorkingGroupSectionI;
  className?: string;
};

export const WorkingGroupSection = ({
  id,
  content,
  className = "bg-white",
}: Props) => {
  const t = useTranslations("WorkingGroupSection");
  const footerT = useTranslations("Footer");

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
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#989F43] md:text-sm">
            {footerT("aboutMenu.grupoDeTrabalho")}
          </p>
          <h2 className="text-[28px] md:text-[36px] lg:text-[42px] leading-tight font-bold text-[#21240F]">
            {title}
          </h2>
        </div>

        <div className="text-[15px] md:text-[16px] leading-[150%] text-[#292829]">
          {text}
        </div>

        {content.milestones.length > 0 && (
          <div className="mt-6">
            {/* Desktop: horizontal timeline */}
            <div className="relative hidden md:flex md:flex-col">
              <div className="pointer-events-none absolute top-4 right-16 left-16 h-0.5 bg-[#989F43]" />
              <div className="flex justify-between">
                {content.milestones.map((milestone, index) => {
                  const date = t.has(`milestones.${index}.date`)
                    ? t(`milestones.${index}.date`)
                    : milestone.date;
                  const milestoneTitle = t.has(`milestones.${index}.title`)
                    ? t(`milestones.${index}.title`)
                    : milestone.title;
                  const description = t.has(
                    `milestones.${index}.description`,
                  )
                    ? t(`milestones.${index}.description`)
                    : milestone.description;

                  return (
                    <div
                      key={`${milestone.title}-${index}`}
                      className="flex max-w-[260px] flex-1 flex-col items-center px-4 text-center"
                    >
                      <span
                        className={cn(
                          "z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white",
                          milestone.isCurrent
                            ? "bg-[#BF360C]"
                            : "bg-[#989F43]",
                        )}
                      >
                        {index + 1}
                      </span>
                      <span className="mt-4 text-xs font-bold uppercase tracking-wide text-[#BF360C]">
                        {date}
                      </span>
                      <span className="mt-2 text-base font-bold text-[#21240F]">
                        {milestoneTitle}
                      </span>
                      <span className="mt-2 text-sm text-[#3F4324]">
                        {description}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile: vertical timeline */}
            <div className="flex flex-col md:hidden">
              {content.milestones.map((milestone, index) => {
                const date = t.has(`milestones.${index}.date`)
                  ? t(`milestones.${index}.date`)
                  : milestone.date;
                const milestoneTitle = t.has(`milestones.${index}.title`)
                  ? t(`milestones.${index}.title`)
                  : milestone.title;
                const description = t.has(`milestones.${index}.description`)
                  ? t(`milestones.${index}.description`)
                  : milestone.description;
                const isLast = index === content.milestones.length - 1;

                return (
                  <div key={`${milestone.title}-${index}`} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
                          milestone.isCurrent
                            ? "bg-[#BF360C]"
                            : "bg-[#989F43]",
                        )}
                      >
                        {index + 1}
                      </span>
                      {!isLast && (
                        <span className="mt-1 w-0.5 flex-1 bg-[#989F43]" />
                      )}
                    </div>
                    <div className={cn("text-left", !isLast && "pb-6")}>
                      <span className="text-xs font-bold uppercase tracking-wide text-[#BF360C]">
                        {date}
                      </span>
                      <p className="mt-1 text-base font-bold text-[#21240F]">
                        {milestoneTitle}
                      </p>
                      <p className="mt-1 text-sm text-[#3F4324]">
                        {description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default WorkingGroupSection;
