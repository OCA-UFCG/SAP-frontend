import Image from "next/image";
import { AboutSectionI } from "@/utils/interfaces";
import { useTranslations } from "next-intl";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";

const INFO_ROW_KEYS = ["ted", "oca", "ufcgInsa", "dcdeMma"] as const;

const INFO_ROW_LABELS: Record<(typeof INFO_ROW_KEYS)[number], string> = {
  ted: "TED",
  oca: "OCA",
  ufcgInsa: "UFCG · INSA",
  dcdeMma: "DCDE/MMA",
};

type Props = {
  id?: string;
  content: AboutSectionI;
  onClick?: () => void;
  className?: string;
};

export const AboutSection = ({ id, content, className = "" }: Props) => {
  const t = useTranslations("AboutSection");
  const imageSrc = content.image.url;

  const title = t("title", { title: content.title });
  const text = t.has("text") ? t("text") : documentToReactComponents(content.text.json);

  return (
    <section
      id={id}
      className={`w-full scroll-mt-16.5 bg-[#E4E5E2] flex flex-col items-start ${className}`}
    >
      <div className="w-full max-w-[1440px] mx-auto px-4 py-12 md:px-10 lg:px-[80px] flex flex-col gap-6">
        <div className="flex flex-col items-start gap-4">
          <h2 className="text-[1.5rem] md:text-[1.75rem] lg:text-[1.875rem] leading-[28px] md:leading-[32px] lg:leading-[36px] tracking-[-0.0075em] font-open-sans text-[#292829] font-semibold text-left">
            {title}
          </h2>
          <div className="font-inter text-[0.9375rem] md:text-[1rem] leading-[150%] text-[#292829] text-left">
            {text}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-start lg:items-stretch gap-6 w-full">
          <div className="flex w-full flex-1 flex-col justify-center gap-4">
            {INFO_ROW_KEYS.map((key) => (
              <div key={key} className="flex min-h-[56px] items-stretch">
                {/* Texto escuro: o branco do Figma no verde claro dá só 2,8:1. */}
                <div className="flex w-1/3 shrink-0 items-center rounded-l-lg bg-[#989F43] px-5 py-2 sm:w-1/4">
                  <span className="text-base sm:text-xl font-semibold leading-6 text-[#21240F]">
                    {INFO_ROW_LABELS[key]}
                  </span>
                </div>
                <div className="flex flex-1 items-center rounded-r-lg bg-white px-5 py-2">
                  <span className="text-sm sm:text-base font-semibold leading-6 text-[#292829]">
                    {t(`infoRows.${key}`)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="relative mx-auto h-[240px] w-full shrink-0 overflow-hidden rounded-lg lg:mx-0 lg:h-[320px] lg:flex-1">
            <Image
              src={imageSrc}
              alt={title}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
