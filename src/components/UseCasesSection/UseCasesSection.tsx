import { useTranslations } from "next-intl";
import { HomeCarousel } from "@/components/HomeCarousel/HomeCarousel";
import { QuoteIcon } from "@/components/HomeIcons/HomeIcons";

const PROFILE_KEYS = [
  "public-management",
  "researchers",
  "communities",
] as const;

type Props = {
  id?: string;
};

/** "Quais são as possibilidades de uso do SEDES?": um card por perfil. */
export const UseCasesSection = ({ id }: Props) => {
  const t = useTranslations("UseCasesSection");

  return (
    <section id={id} className="w-full scroll-mt-16.5 bg-[#21240F]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-12 md:px-10 lg:px-20">
        <h2 className="pb-2 font-open-sans text-[30px] font-semibold leading-9 tracking-[-0.0075em] text-[#F8F7F8]">
          {t("title")}
        </h2>

        <HomeCarousel variant="dark">
          {PROFILE_KEYS.map((key) => (
            <figure
              key={key}
              className="flex h-full flex-col rounded-lg bg-[#F8F7F8] p-6 font-inter text-sm leading-6 text-[#292829]"
            >
              <QuoteIcon size={20} className="mb-3 -ml-1 text-[#989F43]" />
              <blockquote>{t(`profiles.${key}.text`)}</blockquote>
              <figcaption className="mt-auto pt-4">
                <span className="block font-semibold">
                  {t(`profiles.${key}.name`)}
                </span>
                <span className="block">{t(`profiles.${key}.audience`)}</span>
              </figcaption>
            </figure>
          ))}
        </HomeCarousel>
      </div>
    </section>
  );
};

export default UseCasesSection;
