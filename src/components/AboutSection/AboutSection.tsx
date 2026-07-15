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
  const footerT = useTranslations("Footer");
  const imageSrc = content.image.url;

  const title = t("title", { title: content.title });
  const text = t.has("text") ? t("text") : documentToReactComponents(content.text.json);

  return (
    <section
      id={id}
      className={`w-full scroll-mt-16.5 bg-white flex flex-col items-start ${className}`}
    >
      <div className="w-full max-w-[1440px] mx-auto px-4 py-12 md:px-10 lg:px-[80px] flex flex-col gap-[33px]">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#989F43] md:text-sm">
            {footerT("aboutMenu.financiamento")}
          </p>
          <h2 className="text-[24px] md:text-[28px] lg:text-[30px] leading-[28px] md:leading-[32px] lg:leading-[36px] tracking-[-0.0075em] text-[#292829] font-semibold text-left">
            {title}
          </h2>
        </div>

        <div className="text-[15px] md:text-[16px] leading-[150%] text-[#292829] text-left">
          {text}
        </div>

        <div className="flex flex-col lg:flex-row items-start lg:items-stretch gap-[33px] w-full">
          <div className="flex flex-col gap-3 w-full flex-1">
            {INFO_ROW_KEYS.map((key) => (
              <div
                key={key}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 rounded-lg border border-[#E4E5E2] bg-[#F6F7F6] px-5 py-4"
              >
                <span className="font-bold text-[#21240F]">
                  {INFO_ROW_LABELS[key]}
                </span>
                <span className="text-sm text-[#292829] sm:text-right">
                  {t(`infoRows.${key}`)}
                </span>
              </div>
            ))}
          </div>

          <div className="shrink-0 mx-auto lg:mx-0 w-full lg:w-auto lg:max-w-[480px] rounded-[8px] overflow-hidden">
            <Image
              src={imageSrc}
              alt={title}
              width={420}
              height={320}
              className="w-full h-auto lg:w-auto lg:h-full rounded-[8px] object-contain"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
