import Image from "next/image";
import { Link } from "@/translations/routing";
import { HomeTextsI, PlatformModulesSectionI } from "@/utils/interfaces";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  ChevronRightIcon,
  MODULE_ICONS,
} from "@/components/HomeIcons/HomeIcons";

type Props = {
  id?: string;
  content: PlatformModulesSectionI;
  texts: HomeTextsI["tools"];
  className?: string;
};

export const PlatformModulesSection = ({
  id,
  content,
  texts,
  className = "bg-[#E4E5E2]",
}: Props) => {
  const t = useTranslations("PlatformModulesSection");

  return (
    <section
      id={id}
      className={cn("w-full scroll-mt-16.5", className)}
    >
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-9 px-4 py-12 md:px-10 lg:px-20">
        <div className="flex flex-col gap-2">
          <h2 className="font-open-sans text-[30px] font-semibold leading-9 tracking-[-0.0075em] text-[#292829]">
            {texts.title}
          </h2>
          {texts.subtitle && (
            <p className="font-open-sans text-base leading-6 text-[#292829]">
              {texts.subtitle}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {content.modules.map((module) => {
            const ModuleIcon = MODULE_ICONS[module.id];
            const text = texts.items.find((item) => item.id === module.id);
            if (!text) return null;

            return (
              <article
                key={module.id}
                className="flex flex-col overflow-hidden rounded-lg border border-[#EFEFEF] bg-white shadow-sm"
              >
                <div className="relative h-[258px] w-full shrink-0">
                  <Image
                    src={text.image ?? module.image}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>

                <div className="flex flex-col gap-4 px-6 pt-4 pb-6 text-[#0F172A]">
                  <h3 className="flex items-center gap-4 font-open-sans text-2xl font-bold leading-[33px] text-[#292829]">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#5B612A] p-1 text-[#F8F7F8]">
                      <ModuleIcon size={32} />
                    </span>
                    {text.name}
                  </h3>
                  <p className="font-inter text-sm leading-6">
                    {text.shortText}
                  </p>
                  {text.fullText && (
                    <details className="group/more font-inter">
                      <summary className="w-fit cursor-pointer list-none text-sm font-semibold leading-6 text-[#777E32] hover:underline [&::-webkit-details-marker]:hidden">
                        <span className="group-open/more:hidden">
                          {t("seeMore")}
                        </span>
                        <span className="hidden group-open/more:inline">
                          {t("seeLess")}
                        </span>
                      </summary>
                      <p className="pt-2 text-sm leading-6">{text.fullText}</p>
                    </details>
                  )}
                </div>

                <div className="mt-auto px-6 pt-3 pb-6">
                  <Link
                    href={module.href}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#989F43] px-4 py-2 font-inter text-sm leading-6 text-[#F8F7F8] transition-colors hover:bg-[#5B612A]"
                  >
                    {text.buttonText}
                    <ChevronRightIcon size={16} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PlatformModulesSection;
