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

  const languages = [
    { code: "pt", name: "Português" },
    { code: "en", name: "English" },
    { code: "es", name: "Español" },
  ] as const;

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-stone-200 hover:bg-stone-100 text-stone-700 hover:text-stone-900 transition-colors focus:outline-none focus:ring-2 focus:ring-[#777E32] cursor-pointer h-10"
        aria-label={t("changeLanguage")}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4 stroke-[#21240F]"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
        <span className="text-xs font-semibold uppercase text-[#21240F]">
          {locale}
        </span>
        <Icon id="chevron-down" size={10} className="fill-[#21240F] ml-0.5" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-40 rounded-md border border-stone-200 bg-white py-1 shadow-lg z-50 animate-in fade-in slide-in-from-top-1 duration-100"
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
              <span>{lang.name}</span>
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
