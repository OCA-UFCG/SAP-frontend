import Image from "next/image";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import { WorkingGroupSectionI } from "@/utils/interfaces";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type Props = {
  id?: string;
  content: WorkingGroupSectionI;
  /** Foto à esquerda da seção; sem ela, o texto ocupa a largura toda. */
  image?: string;
  className?: string;
};

export const WorkingGroupSection = ({
  id,
  content,
  image,
  className = "bg-white",
}: Props) => {
  const t = useTranslations("WorkingGroupSection");

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
      <div className="w-full max-w-[1440px] mx-auto px-4 py-12 md:px-10 lg:px-[80px] flex flex-col gap-6 lg:flex-row">
        {image && (
          <div className="relative h-[240px] w-full shrink-0 overflow-hidden rounded-lg lg:h-auto lg:w-[301px]">
            <Image
              src={image}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 301px"
              className="object-cover"
            />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex flex-col items-start gap-4">
            <h2 className="pb-2 font-open-sans text-[1.5rem] md:text-[1.75rem] lg:text-[1.875rem] leading-[28px] md:leading-[32px] lg:leading-[36px] tracking-[-0.0075em] font-semibold text-[#292829]">
              {title}
            </h2>
            <div className="font-inter text-[0.9375rem] md:text-[1rem] leading-[150%] text-[#292829]">
              {text}
            </div>
          </div>

          {content.milestones.length > 0 && (
            <div>
              {/* Desktop: linha do tempo na horizontal, um marco por coluna */}
              <div className="hidden md:flex md:flex-col md:gap-2">
                <div className="relative h-[23px]">
                  <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-[#E1E2B4]" />
                  <div className="relative flex gap-6">
                    {content.milestones.map((milestone, index) => (
                      <span
                        key={`dot-${milestone.title}-${index}`}
                        className="flex-1 pl-3"
                      >
                        <span className="block h-[23px] w-[23px] rounded-full border-[5px] border-[#E1E2B4] bg-[#989F43]" />
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-6">
                  {content.milestones.map((milestone, index) => (
                    <span
                      key={`date-${milestone.title}-${index}`}
                      className="flex-1 font-open-sans text-sm font-semibold leading-[19px] text-[#5B612A]"
                    >
                      {milestoneCopy(index, milestone).date}
                    </span>
                  ))}
                </div>

                <div className="flex gap-6">
                  {content.milestones.map((milestone, index) => {
                    const copy = milestoneCopy(index, milestone);

                    return (
                      <div
                        key={`card-${milestone.title}-${index}`}
                        className="flex min-w-0 flex-1 flex-col gap-2 rounded-b-lg border-t-[3px] border-[#989F43] bg-white p-5 font-open-sans text-[#292829]"
                      >
                        <p className="text-base font-semibold leading-[22px]">
                          {copy.title}
                        </p>
                        <p className="text-sm leading-[19px]">
                          {copy.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mobile: linha do tempo na vertical */}
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
                        <span className="h-[23px] w-[23px] shrink-0 rounded-full border-[5px] border-[#E1E2B4] bg-[#989F43]" />
                        {!isLast && (
                          <span className="w-[3px] flex-1 bg-[#E1E2B4]" />
                        )}
                      </div>

                      <div className={cn("flex-1 text-left", !isLast && "pb-6")}>
                        <span className="font-open-sans text-sm font-semibold leading-[19px] text-[#5B612A]">
                          {copy.date}
                        </span>
                        <div className="mt-2 flex flex-col gap-2 rounded-b-lg border-t-[3px] border-[#989F43] bg-white p-5 font-open-sans text-[#292829]">
                          <p className="text-base font-semibold leading-[22px]">
                            {copy.title}
                          </p>
                          <p className="text-sm leading-[19px]">
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
      </div>
    </section>
  );
};

export default WorkingGroupSection;
