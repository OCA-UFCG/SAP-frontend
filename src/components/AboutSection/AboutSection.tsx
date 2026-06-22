import Image from "next/image";
import { Link } from "@/translations/routing";
import { AboutSectionI } from "@/utils/interfaces";
import { useTranslations } from "next-intl";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";

type Props = {
  content: AboutSectionI;
  onClick?: () => void;
  className?: string;
};

export const AboutSection = ({ content, onClick, className = "" }: Props) => {
  const t = useTranslations("AboutSection");
  const imageSrc = content.image.url;

  const title = t("title", { title: content.title });
  const text = t.has("text") ? t("text") : documentToReactComponents(content.text.json);

  return (
    <section
      className={`w-full bg-white flex flex-col items-start ${className}`}
    >
      <div className="w-full max-w-[1440px] mx-auto px-4 py-12 md:px-10 lg:px-[80px] flex flex-col gap-[33px]">
        <h2 className="text-[24px] md:text-[28px] lg:text-[30px] leading-[28px] md:leading-[32px] lg:leading-[36px] tracking-[-0.0075em] text-[#292829] font-semibold text-left">
          {title}
        </h2>

        <div className="flex flex-col lg:flex-row items-start gap-[33px] w-full">
          <div className="shrink-0 mx-auto lg:mx-0">
            <Image
              src={imageSrc}
              alt={title}
              width={630}
              height={320}
              className="w-full max-w-[630px] lg:w-[630px] h-[220px] md:h-[280px] lg:h-[320px] rounded-[8px] object-cover"
            />
          </div>

          <div className="flex flex-col gap-[33px] w-full lg:max-w-[621px] flex-1">
            <div className="text-[15px] md:text-[16px] leading-[150%] text-[#292829] text-left">
              {text}
            </div>

            <Link
              href="/contact"
              className="flex justify-center items-center px-4 py-2 h-[40px] w-full bg-[#989F43] rounded-[6px] text-[14px] leading-[24px] text-[#F8F7F8] transition hover:opacity-90"
            >
              {t("seeMore")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
