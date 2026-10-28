"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import { Icon } from "../Icon/Icon";
import {
  GlossaryHeaderI,
  GlossaryTermI,
} from "@/repositories/content/siteContentRepository";

type Props = {
  terms: GlossaryTermI[];
  /** Título e frase do topo vindos do Contentful; sem eles, os das traduções. */
  header?: GlossaryHeaderI;
};

// Busca e letra inicial ignoram acento e caixa: "indice" acha "Índice de
// Aridez", e ele entra na letra I.
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("pt-BR");

const initialOf = (term: string) => normalize(term.trim()).charAt(0);

export const GlossarySection = ({ terms, header }: Props) => {
  const t = useTranslations("Glossary");
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState<string | null>(null);

  const translatedTerms = useMemo(
    () =>
      terms.map((term) => {
        const translationKey = `entries.${term.id}`;
        return {
          ...term,
          term: t.has(`${translationKey}.term`)
            ? t(`${translationKey}.term`)
            : term.term,
          definition: t.has(`${translationKey}.definition`)
            ? t(`${translationKey}.definition`)
            : term.definition,
        };
      }),
    [terms, t],
  );

  const letters = useMemo(
    () =>
      [...new Set(translatedTerms.map((term) => initialOf(term.term)))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [translatedTerms],
  );

  const normalizedQuery = normalize(query.trim());
  const visibleTerms = translatedTerms.filter(
    (term) =>
      (!letter || initialOf(term.term) === letter) &&
      (!normalizedQuery ||
        normalize(term.term).includes(normalizedQuery) ||
        normalize(term.definition).includes(normalizedQuery)),
  );

  const filterButtonClass = (active: boolean) =>
    `h-[36px] min-w-[36px] px-[14px] rounded-[5px] text-[0.8rem] leading-[22px] border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B612A] ${
      active
        ? "bg-[#989F43] border-[#989F43] text-white"
        : "bg-white border-[#E4E5E2] text-[#5B612A] hover:bg-[#F6F7F6]"
    }`;

  return (
    <section className="w-full bg-white">
      <div className="w-full bg-[#E4E5E2]">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-[80px] pt-12 lg:pt-[80px] pb-12 flex flex-col lg:flex-row gap-6">
          <div className="lg:w-[465px] lg:shrink-0 flex flex-col gap-[10px]">
            <h1 className="font-bold text-[2rem] sm:text-[2.5rem] lg:text-[3rem] leading-[120%] text-[#292829]">
              {header?.title ?? t("title")}
            </h1>
            <div className="text-[1rem] leading-[24px] text-[#292829]">
              {header?.text ? (
                documentToReactComponents(header.text.json)
              ) : (
                <p>{t("subtitle")}</p>
              )}
            </div>
          </div>

          {terms.length > 0 && (
            <div className="lg:flex-1 flex flex-col gap-6">
              <label className="flex items-center gap-2 h-10 px-4 bg-white border border-[#E4E5E2] rounded-lg focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#5B612A]">
                <Icon
                  id="loupe"
                  size={16}
                  fill="#292829"
                  className="opacity-50 shrink-0"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchPlaceholder")}
                  className="flex-1 min-w-0 bg-transparent text-[0.875rem] leading-[20px] text-[#292829] placeholder:text-[#676264]/50 outline-none"
                />
              </label>

              <div
                role="group"
                aria-label={t("letterFilter")}
                className="flex flex-wrap items-center gap-2"
              >
                <button
                  type="button"
                  aria-pressed={letter === null}
                  onClick={() => setLetter(null)}
                  className={filterButtonClass(letter === null)}
                >
                  {t("allLetters")}
                </button>
                {letters.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={letter === item}
                    onClick={() => setLetter(item)}
                    className={filterButtonClass(letter === item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-[80px] py-12">
        {terms.length === 0 ? (
          <p className="text-[1rem] text-[#292829]">{t("empty")}</p>
        ) : (
          <>
            <p role="status" className="sr-only">
              {t("resultCount", { count: visibleTerms.length })}
            </p>
            {visibleTerms.length === 0 ? (
              <p className="text-[1rem] text-[#292829]">{t("noResults")}</p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {visibleTerms.map((term) => (
                  <li
                    key={term.id}
                    className="flex flex-col justify-between gap-[18px] p-6 bg-[#E4E5E2] border border-[#E4E5E2] rounded-lg"
                  >
                    <div className="flex flex-col gap-[18px]">
                      <h2 className="font-semibold text-[1.25rem] leading-[24px] text-black">
                        {term.term}
                      </h2>
                      <p className="text-[1rem] leading-[24px] text-black">
                        {term.definition}
                      </p>
                    </div>
                    {term.tags.length > 0 && (
                      <ul className="flex flex-wrap items-center gap-[6.5px]">
                        {term.tags.map((tag) => (
                          <li
                            key={tag}
                            className="px-[10px] py-[2px] rounded-full bg-[#989F43] font-inter font-semibold text-[0.75rem] leading-[16px] text-white"
                          >
                            {tag}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default GlossarySection;
