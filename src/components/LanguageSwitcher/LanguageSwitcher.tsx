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
        className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-stone-200 hover:text-[#777E32] transition-colors focus:outline-none focus:ring-2 focus:ring-[#777E32] cursor-pointer h-10 font-medium text-neutral-800"
        aria-label={t("changeLanguage")}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {/* Globo desenhado inline: o sprite em /sprite.svg não tem um ícone de
            idioma, e o de carta que estava aqui não representa troca de idioma. */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4 shrink-0"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
        {/* O cabeçalho divide espaço com o logo, o Entrar e o menu hambúrguer,
            então o idioma ativo aparece sempre pela sigla, em qualquer tela. */}
        <span className="text-sm font-semibold">{activeLanguage.acronym}</span>
        <Icon id="chevron-down" size={10} />
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
