"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import citiesIndex from "@/data/citiesIndex.json";
import { normalize } from "@/utils/functions";
import { searchMatchRank } from "@/utils/searchMatch";
import {
  closeWhenFocusLeaves,
  handleComboboxInputKey,
  handleComboboxListKeyDown,
} from "@/utils/listboxKeyboard";

// A lista inteira tem 5.570 municípios; sem nada digitado, mostrar as
// primeiras já diz o que o campo espera, sem desenhar milhares de botões.
const MAX_OPTIONS = 100;

const MUNICIPALITIES = [...citiesIndex]
  .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"))
  .map((municipality) => ({
    ...municipality,
    normalizedName: normalize(municipality.name),
    normalizedLabel: normalize(municipality.label),
  }));

/**
 * Campo para escolher um município pelo nome ("Campina Grande - PB"). Mostra o
 * escolhido enquanto ninguém digita; as sugestões vêm na ordem da busca, com o
 * nome exato primeiro.
 */
export function MunicipalitySearch({
  municipalityCode,
  onSelect,
  onClear,
  labelledBy,
}: {
  municipalityCode: string | null;
  onSelect: (municipalityCode: string, stateKey: string) => void;
  onClear: () => void;
  /** Id do rótulo visível do campo. */
  labelledBy?: string;
}) {
  const t = useTranslations("AnalysisPanel");
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selected = MUNICIPALITIES.find(
    (municipality) => municipality.code === municipalityCode,
  );

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isOpen]);

  const options = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    if (!normalizedQuery) return MUNICIPALITIES.slice(0, MAX_OPTIONS);
    return MUNICIPALITIES.map((municipality) => ({
      municipality,
      rank: searchMatchRank(normalizedQuery, [
        municipality.normalizedName,
        municipality.normalizedLabel,
      ]),
    }))
      .filter(({ rank }) => rank !== null)
      .sort((left, right) => (left.rank ?? 0) - (right.rank ?? 0))
      .slice(0, MAX_OPTIONS)
      .map(({ municipality }) => municipality);
  }, [query]);

  const select = (code: string, stateKey: string) => {
    // A opção some com a lista: sem devolver o foco ao campo, ele caía no
    // topo da página.
    inputRef.current?.focus();
    setQuery("");
    setIsOpen(false);
    onSelect(code, stateKey);
  };

  const clear = () => {
    setQuery("");
    onClear();
    inputRef.current?.focus();
  };

  return (
    <div
      ref={pickerRef}
      onBlur={closeWhenFocusLeaves(() => setIsOpen(false))}
      className="relative w-full min-w-0"
    >
      <div className="flex h-10 w-full items-center overflow-hidden rounded-md border border-[#DCDBDC] bg-white px-3 transition hover:border-neutral-400 focus-within:border-neutral-600 focus-within:ring-2 focus-within:ring-neutral-600">
        {/* Com a cidade escolhida a lupa sai: em meia largura, o espaço dela
            é o que faltava para "Campina Grande - PB" caber inteiro. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`mr-2 h-4 w-4 shrink-0 text-[#6F6F6F] ${selected && query === "" ? "hidden" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          value={selected && query === "" ? selected.label : query}
          title={selected?.label}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (
              handleComboboxInputKey(
                event.key,
                listRef.current,
                isOpen,
                setIsOpen,
              )
            ) {
              event.preventDefault();
            }
          }}
          role="combobox"
          aria-labelledby={labelledBy}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className="min-w-0 flex-1 truncate border-none bg-transparent p-0 text-[0.8125rem] leading-5 text-[#292829] outline-none ring-0 placeholder:text-[0.75rem] placeholder:text-[#6F6F6F]"
          placeholder={t("municipalitySearch.placeholder")}
        />
        {(query || municipalityCode) && (
          <button
            type="button"
            onClick={clear}
            className="ml-1 shrink-0 rounded px-1 text-base leading-none text-[#6F6F6F] hover:text-[#292829]"
            aria-label={t("municipalitySearch.clear")}
          >
            ×
          </button>
        )}
      </div>
      {isOpen && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={labelledBy}
          tabIndex={-1}
          onKeyDown={(event) =>
            handleComboboxListKeyDown(event, inputRef.current, () =>
              setIsOpen(false),
            )
          }
          className="absolute top-[calc(100%+8px)] right-0 z-30 max-h-64 w-[max(100%,240px)] origin-top overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg motion-safe:animate-[menu-in_180ms_ease-out]"
        >
          {options.length > 0 ? (
            options.map((municipality) => (
              <button
                key={municipality.code}
                type="button"
                role="option"
                // Fora do Tab: as setas andam pela lista, e o Tab sai dela.
                tabIndex={-1}
                aria-selected={municipalityCode === municipality.code}
                onClick={() => select(municipality.code, municipality.uf)}
                className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-[#292829] transition hover:bg-[#F6F7F6] hover:text-[#4F5424] aria-selected:bg-[#F5F6EE] aria-selected:font-medium aria-selected:text-[#5B612A]"
              >
                {municipality.label}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-[#6F6F6F]">{t("municipalitySearch.noResults")}</p>
          )}
        </div>
      )}
    </div>
  );
}
