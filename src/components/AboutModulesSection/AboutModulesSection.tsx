"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/translations/routing";
import { HomeTextsI, PlatformModuleI } from "@/utils/interfaces";
import { MODULE_ICONS } from "@/components/HomeIcons/HomeIcons";
import { cn } from "@/lib/utils";

type Props = {
  modules: PlatformModuleI[];
  /** Os mesmos textos dos cards da home (Contentful, com as traduções de reserva). */
  texts: HomeTextsI["tools"];
  /** Título da seção no Contentful; inglês e espanhol usam o das traduções. */
  title?: string;
};

/** "Conheça os Módulos": um card largo por módulo, com o texto completo no "Ver mais". */
export const AboutModulesSection = ({ modules, texts, title }: Props) => {
  const t = useTranslations("AboutPage.modules");
  const [expanded, setExpanded] = useState<PlatformModuleI["id"] | null>(null);

  return (
    <section className="w-full bg-white">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-12 md:px-10 lg:px-20">
        <h2 className="pb-2 font-open-sans text-[1.5rem] font-semibold leading-[28px] tracking-[-0.0075em] text-[#292829] md:text-[1.75rem] md:leading-[32px] lg:text-[1.875rem] lg:leading-[36px]">
          {t.has("title") ? t("title") : title}
        </h2>

        <div className="flex flex-col gap-4">
          {modules.map((module) => {
            const ModuleIcon = MODULE_ICONS[module.id];
            const text = texts.items.find((item) => item.id === module.id);
            if (!text) return null;
            const isOpen = expanded === module.id;
            const fullTextId = `modulo-${module.id}-completo`;

            return (
              <article
                key={module.id}
                className="flex flex-col overflow-hidden rounded-lg bg-[#F6F7F6] md:flex-row"
              >
                <div className="relative h-[180px] w-full shrink-0 md:h-auto md:min-h-[160px] md:w-[300px]">
                  <Image
                    // "Foto na página Sobre" do módulo; sem ela, a do card da home.
                    src={text.aboutImage ?? text.image ?? module.image}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 300px"
                    className="object-cover"
                  />
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 md:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="flex items-center gap-3 font-open-sans text-xl font-bold leading-7 text-[#292829]">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#5B612A] text-[#F8F7F8]">
                        <ModuleIcon size={24} />
                      </span>
                      {text.name}
                    </h3>
                    <Link
                      href={module.href}
                      className="rounded-md bg-[#646B2D] px-4 py-2 font-inter text-sm leading-5 text-[#F8F7F8] transition-colors hover:bg-[#4F5424]"
                    >
                      {text.buttonText}
                    </Link>
                  </div>

                  <p
                    className={cn(
                      "font-open-sans text-sm leading-[19px] text-[#292829]",
                      !isOpen && "line-clamp-3",
                    )}
                  >
                    {text.shortText}
                  </p>
                  {isOpen && text.fullText && (
                    <p
                      id={fullTextId}
                      className="font-open-sans text-sm leading-[19px] text-[#292829]"
                    >
                      {text.fullText}
                    </p>
                  )}

                  {text.fullText && (
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={isOpen ? fullTextId : undefined}
                      onClick={() => setExpanded(isOpen ? null : module.id)}
                      className="flex w-fit cursor-pointer items-center gap-1 font-open-sans text-xs font-semibold text-[#3F4324] hover:underline"
                    >
                      {isOpen ? t("seeLess") : t("seeMore")}
                      <svg
                        width={16}
                        height={16}
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden
                        className={cn("transition-transform", isOpen && "rotate-180")}
                      >
                        <path d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z" />
                      </svg>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default AboutModulesSection;
