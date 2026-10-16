import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/translations/routing";
import { HomeFeatureI, PlatformModuleI } from "@/utils/interfaces";
import {
  ArrowForwardIcon,
  MODULE_ICONS,
} from "@/components/HomeIcons/HomeIcons";
import { Reveal, revealOrder } from "@/components/HomeMotion/HomeMotion";

type Props = {
  id?: string;
  title: string;
  items: HomeFeatureI[];
  /** Nome de cada ferramenta, para a etiqueta do card. */
  toolNames: Partial<Record<PlatformModuleI["id"], string>>;
};

/** "Recursos em destaque": lista com a ferramenta, o recurso e o link. */
export const NewsSection = ({ id, title, items, toolNames }: Props) => {
  const t = useTranslations("NewsSection");
  // As datas são AAAA-MM-DD; em UTC o dia não muda com o fuso de quem lê.
  const formatDate = new Intl.DateTimeFormat(useLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

  if (!items.length) return null;

  return (
    <section id={id} className="w-full scroll-mt-16.5 bg-[#E4E5E2]">
      <Reveal className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-12 md:px-10 lg:px-20">
        <h2 className="reveal-item pt-[3px] font-inter text-[30px] font-semibold leading-9 tracking-[-0.0075em] text-[#292829]">
          {title}
        </h2>

        <ul className="flex flex-col">
          {items.map((item, index) => {
            const ModuleIcon = MODULE_ICONS[item.module];
            return (
              <li
                key={item.id}
                style={revealOrder(index + 1)}
                className="reveal-item border-b border-[#C8CAC5]"
              >
                {/* No hover a linha clareia, ganha uma barra verde à esquerda
                    e a seta corre para a direita. */}
                <Link
                  href={item.href}
                  className="group relative flex items-center gap-4 p-6 text-[#292829] transition-colors hover:bg-[#D9DBD6]"
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-1 origin-top scale-y-0 bg-[#777E32] transition-[scale] duration-300 group-hover:scale-y-100"
                  />
                  <div className="flex flex-1 flex-col gap-2 transition-[translate] duration-300 sm:flex-row sm:items-center sm:gap-4 motion-safe:group-hover:translate-x-2">
                    <span className="flex w-fit shrink-0 items-center gap-2 rounded-full bg-[#989F43] px-2.5 py-0.5 font-inter text-xs font-semibold leading-4 text-[#F8F7F8] transition-colors group-hover:bg-[#5B612A]">
                      <ModuleIcon size={20} />
                      {toolNames[item.module]}
                    </span>
                    <span className="font-open-sans text-base leading-6">
                      {item.title}
                    </span>
                    {item.date && (
                      <time
                        dateTime={item.date}
                        className="font-inter text-sm font-medium leading-6 text-[#777E32] sm:ml-auto"
                      >
                        {formatDate.format(new Date(item.date))}
                      </time>
                    )}
                  </div>
                  <span className="flex shrink-0 px-4 py-2 text-[#989F43] transition-[translate,color] duration-300 group-hover:text-[#5B612A] motion-safe:group-hover:translate-x-2">
                    <span className="sr-only">{t("learnMore")}</span>
                    <ArrowForwardIcon size={16} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Reveal>
    </section>
  );
};

export default NewsSection;
