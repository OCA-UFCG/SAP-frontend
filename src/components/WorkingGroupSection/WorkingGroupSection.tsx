import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import { WorkingGroupSectionI } from "@/utils/interfaces";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/Badge/Badge";

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

  const milestoneCopy = (index: number, milestone: (typeof content.milestones)[number]) => ({
    date: t.has(`milestones.${index}.date`)
      ? t(`milestones.${index}.date`)
      : milestone.date,
    title: t.has(`milestones.${index}.title`)
      ? t(`milestones.${index}.title`)
      : milestone.title,
    description: t.has(`milestones.${index}.description`)
      ? t(`milestones.${index}.description`)
      : milestone.description,
  });

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
          <Badge label={footerT("aboutMenu.grupoDeTrabalho")} />
          <h2 className="text-[24px] md:text-[28px] lg:text-[30px] leading-[28px] md:leading-[32px] lg:leading-[36px] tracking-[-0.0075em] font-semibold text-[#292829]">
            {title}
          </h2>
          <div className="text-[15px] md:text-[16px] leading-[150%] text-[#292829]">
            {text}
          </div>
        </div>

        {content.milestones.length > 0 && (
          <div>
            {/* Desktop: horizontal timeline */}
            <div className="hidden md:block">
              <div className="flex justify-between">
                {content.milestones.map((milestone, index) => (
                  <span
                    key={`date-${milestone.title}-${index}`}
                    className="min-w-0 shrink basis-[228px] text-center text-lg font-semibold text-[#5B612A] lg:text-xl"
                  >
                    {milestoneCopy(index, milestone).date}
                  </span>
                ))}
              </div>

              <div className="relative mt-2 flex h-6 items-center justify-between">
                <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-[#684B40]" />
                {content.milestones.map((milestone, index) => (
                  <span
                    key={`dot-${milestone.title}-${index}`}
                    className="relative flex min-w-0 shrink basis-[228px] justify-center"
                  >
                    <span className="h-[19px] w-[19px] rounded-full bg-[#989F43] ring-4 ring-[#F6F7F6]" />
                  </span>
                ))}
              </div>

              <div className="mt-4 flex justify-between gap-6">
                {content.milestones.map((milestone, index) => {
                  const copy = milestoneCopy(index, milestone);

                  return (
                    <div
                      key={`card-${milestone.title}-${index}`}
                      className="flex min-w-0 shrink basis-[228px] flex-col justify-center gap-2 rounded-[7px] bg-white p-5 shadow-[0px_2px_4px_0px_rgba(0,0,0,0.25)]"
                    >
                      <p className="text-base font-semibold text-[#292829]">
                        {copy.title}
                      </p>
                      <p className="text-[11px] leading-normal text-[#292829]">
                        {copy.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile: vertical timeline */}
            <div className="flex flex-col md:hidden">
              {content.milestones.map((milestone, index) => {
                const copy = milestoneCopy(index, milestone);
                const isLast = index === content.milestones.length - 1;

                return (
                  <div
                    key={`${milestone.title}-${index}`}
                    className="flex gap-4"
                  >
                    <div className="flex flex-col items-center">
                      <span className="h-[19px] w-[19px] shrink-0 rounded-full bg-[#989F43] ring-4 ring-[#F6F7F6]" />
                      {!isLast && (
                        <span className="mt-2 w-0.5 flex-1 bg-[#684B40]" />
                      )}
                    </div>

                    <div className={cn("flex-1 text-left", !isLast && "pb-6")}>
                      <span className="text-lg font-semibold text-[#5B612A]">
                        {copy.date}
                      </span>
                      <div className="mt-2 flex flex-col gap-2 rounded-[7px] bg-white p-5 shadow-[0px_2px_4px_0px_rgba(0,0,0,0.25)]">
                        <p className="text-base font-semibold text-[#292829]">
                          {copy.title}
                        </p>
                        <p className="text-[11px] leading-normal text-[#292829]">
                          {copy.description}
                        </p>
                      </div>
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
