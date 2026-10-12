import Image from "next/image";
import { Link } from "@/translations/routing";
import { HomeTextsI, PlatformModulesSectionI } from "@/utils/interfaces";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { MODULE_ICONS } from "@/components/HomeIcons/HomeIcons";

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
  className = "bg-[#F6F7F6]",
}: Props) => {
  const t = useTranslations("PlatformModulesSection");

  return (
    <section
      id={id}
      className={cn("w-full scroll-mt-16.5", className)}
    >
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-12 md:px-10 lg:px-20">
        <div className="flex flex-col gap-2 pb-2">
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
                className="group relative flex min-h-[420px] flex-col justify-end gap-4 overflow-hidden rounded-md bg-black p-[25px] md:min-h-[480px]"
              >
                {/* A foto tem altura fixa: ao abrir o "Ver mais" o card cresce
                    para baixo e o texto completo fica sobre o fundo preto. A
                    borda inferior some aos poucos para não marcar a junção. */}
                <div className="absolute inset-x-0 top-0 h-[320px] [mask-image:linear-gradient(to_bottom,#000_70%,transparent)] md:h-[365px]">
                  <Image
                    src={module.image}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover object-top"
                  />
                </div>
                <div
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(0deg,#000000_15.84%,rgba(102,102,102,0)_131.77%)]"
                />
                {/* Com o "Ver mais" aberto o texto sobe por cima da foto. */}
                <div
                  aria-hidden
                  className="absolute inset-0 bg-black/70 opacity-0 transition-opacity duration-300 group-has-[details[open]]:opacity-100"
                />

                <div className="relative flex flex-col gap-2 font-open-sans text-[#F8F7F8]">
                  <h3 className="flex items-center gap-2 text-[28px] font-extrabold leading-[38px]">
                    <ModuleIcon size={38} className="shrink-0 text-white" />
                    {text.name}
                  </h3>
                  <p className="text-sm leading-[19px]">{text.shortText}</p>
                  {text.fullText && (
                    <details className="group/more">
                      <summary className="w-fit cursor-pointer list-none text-sm font-semibold leading-[19px] text-[#CCCF87] hover:underline [&::-webkit-details-marker]:hidden">
                        <span className="group-open/more:hidden">
                          {t("seeMore")}
                        </span>
                        <span className="hidden group-open/more:inline">
                          {t("seeLess")}
                        </span>
                      </summary>
                      <p className="pt-2 text-sm leading-[19px]">
                        {text.fullText}
                      </p>
                    </details>
                  )}
                </div>

                <Link
                  href={module.href}
                  className="relative flex w-full items-center justify-center rounded-[4.33px] bg-[#989F43] px-3 py-1.5 font-inter text-[10px] font-medium leading-[17px] text-[#F8F7F8] transition-colors hover:bg-[#7F8639]"
                >
                  {text.buttonText}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PlatformModulesSection;
