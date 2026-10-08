import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/translations/routing";
import { HomeNewsItemI } from "@/utils/interfaces";
import { HomeCarousel } from "@/components/HomeCarousel/HomeCarousel";
import {
  ArrowForwardIcon,
  CalendarIcon,
  MODULE_ICONS,
} from "@/components/HomeIcons/HomeIcons";

type Props = {
  id?: string;
  items: HomeNewsItemI[];
};

/** "O que há de novo?": cards das últimas novidades, por módulo. */
export const NewsSection = ({ id, items }: Props) => {
  const t = useTranslations("NewsSection");
  const moduleT = useTranslations("PlatformModulesSection");
  // As datas são AAAA-MM-DD; em UTC o dia não muda com o fuso de quem lê.
  const formatDate = new Intl.DateTimeFormat(useLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

  if (!items.length) return null;

  return (
    <section id={id} className="w-full scroll-mt-16.5 bg-white">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-12 md:px-10 lg:px-20">
        <h2 className="pb-2 font-open-sans text-[30px] font-semibold leading-9 tracking-[-0.0075em] text-[#292829]">
          {t("title")}
        </h2>

        <HomeCarousel>
          {items.map((item) => {
            const ModuleIcon = MODULE_ICONS[item.module];
            return (
              <Link
                key={item.id}
                href={item.href}
                className="flex h-full flex-col gap-4 rounded-lg bg-[#F8F7F8] p-6 font-inter text-[#292829] transition-colors hover:bg-[#E4E5E2]"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex items-center gap-2 rounded-full bg-[#989F43] px-2.5 py-0.5 text-xs font-semibold leading-4 text-[#F8F7F8]">
                    <ModuleIcon size={20} />
                    {moduleT(`modules.${item.module}.title`)}
                  </span>
                  <span className="flex items-center gap-1 text-sm font-medium leading-6 text-[#989F43]">
                    <CalendarIcon size={24} />
                    <time dateTime={item.date}>
                      {formatDate.format(new Date(item.date))}
                    </time>
                  </span>
                </div>

                <h3 className="text-2xl font-semibold leading-8 tracking-[-0.006em]">
                  {t(`items.${item.id}.title`)}
                </h3>
                <p className="text-sm leading-6">
                  {t(`items.${item.id}.description`)}
                </p>

                <span className="mt-auto flex items-center justify-end gap-2.5 px-4 py-2 text-sm font-medium leading-5 text-[#989F43]">
                  {t("learnMore")}
                  <ArrowForwardIcon size={16} />
                </span>
              </Link>
            );
          })}
        </HomeCarousel>
      </div>
    </section>
  );
};

export default NewsSection;
