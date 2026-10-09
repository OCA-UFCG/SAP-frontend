"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "@/translations/routing";
import { useTranslations, useLocale } from "next-intl";
import { Icon } from "../Icon/Icon";

export const LanguageSwitcher = () => {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLocaleChange = (nextLocale: "pt" | "en" | "es") => {
    setIsOpen(false);
    router.replace(pathname, { locale: nextLocale });
  };

  // A sigla é o que aparece no cabeçalho; o nome por extenso fica para a lista,
  // onde há espaço para quem não reconhece a sigla do próprio idioma.
  const languages = [
    { code: "pt", acronym: "PT-BR", name: "Português" },
    { code: "en", acronym: "EN", name: "English" },
    { code: "es", acronym: "ES", name: "Español" },
  ] as const;

  const activeLanguage =
    languages.find((language) => language.code === locale) ?? languages[0];

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-center gap-2 px-4 py-2 rounded-md hover:bg-stone-200 transition-colors focus:outline-none focus:ring-2 focus:ring-[#777E32] cursor-pointer h-10"
        aria-label={t("changeLanguage")}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {/* Globo e seta desenhados inline: o sprite em /sprite.svg não tem um
            ícone de idioma. Ambos seguem o design (Material "language" e
            "keyboard_arrow_down", na cor #989F43). */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="w-4 h-4 shrink-0 fill-[#989F43]"
          aria-hidden="true"
        >
          <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z" />
        </svg>
        {/* O cabeçalho divide espaço com o logo, o Entrar e o menu hambúrguer,
            então o idioma ativo aparece sempre pela sigla, em qualquer tela. */}
        <span className="font-inter text-sm font-medium leading-6 text-[#292829]">
          {activeLanguage.acronym}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="w-6 h-6 shrink-0 fill-[#989F43]"
          aria-hidden="true"
        >
          <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-48 rounded-md border border-stone-200 bg-white py-1 shadow-lg z-50 animate-in fade-in slide-in-from-top-1 duration-100"
          role="listbox"
          aria-label={t("changeLanguage")}
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleLocaleChange(lang.code)}
              className={`w-full text-left cursor-pointer px-4 py-2 text-sm transition-colors hover:bg-stone-100 flex items-center justify-between ${
                locale === lang.code
                  ? "font-semibold text-[#777E32] bg-stone-50"
                  : "text-stone-700"
              }`}
            >
              <span>
                <span className="font-semibold">{lang.acronym}</span>{" "}
                {lang.name}
              </span>
              {locale === lang.code && (
                <Icon id="check" size={14} className="fill-[#777E32]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
