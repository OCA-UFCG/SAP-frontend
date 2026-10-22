"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "../Icon/Icon";
import { ButtonUi } from "../ButtonUI/ButtonUI";
import { trackUiEvent } from "@/services/telemetry/client";
import {
  handleComboboxInputKey,
  handleComboboxListKeyDown,
} from "@/utils/listboxKeyboard";
import type {
  SearchSubmissionMetadata,
  SearchTelemetryContext,
} from "@/components/SearchBar/types";
import type { SearchSelectionMethod } from "@/types/telemetry";
import {
  filterStateOptions,
  validateSearch,
} from "@/components/SearchBar/searchBarUtils";
import { resolveStateKeyFromSearch } from "@/lib/geo";
import { statesObj } from "@/utils/constants";

interface SearchBarProps {
  onSearch: (value: string, metadata: SearchSubmissionMetadata) => void;
  searchTelemetryContext: SearchTelemetryContext;
  selectedLocationKey?: string;
}

// A mesma chave que o Detalhamento usa: código do município ou UF.
function getLocationKey(value: string) {
  const result = resolveStateKeyFromSearch(value, statesObj);
  return result.type === "city" ? result.city.code : result.key;
}

// No celular, focar o campo abre o teclado por cima da lista e do resultado.
function isTouchScreen() {
  return window.matchMedia("(pointer: coarse)").matches;
}

const SearchBarPlatform = ({
  onSearch,
  searchTelemetryContext,
  selectedLocationKey,
}: SearchBarProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [value, setValue] = useState("");
  const t = useTranslations("SearchBarPlatform");

  // O campo mostra o local escolhido. Se outro local for escolhido fora dele
  // (no ranking ou no mapa), o nome antigo sai em vez de ficar errado.
  const [shownLocationKey, setShownLocationKey] = useState(selectedLocationKey);
  if (shownLocationKey !== selectedLocationKey) {
    setShownLocationKey(selectedLocationKey);
    if (
      selectedLocationKey &&
      value &&
      getLocationKey(value) !== selectedLocationKey
    ) {
      setValue("");
    }
  }

  const filteredSearchOptions = filterStateOptions(value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOptionsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const onSubmit = (selectionMethod: SearchSelectionMethod) => {
    const trimmedValue = value.trim();
    const currentValue =
      trimmedValue.length > 0
        ? trimmedValue
        : (filteredSearchOptions[0] ?? value);
    const visibleOptionCount = filteredSearchOptions.length;

    try {
      validateSearch(currentValue);
      setHasError(false);
      setIsOptionsOpen(false);
      inputRef.current?.blur();
      onSearch(currentValue, {
        selectionMethod,
        visibleOptionCount,
      });
    } catch {
      setHasError(true);
      trackUiEvent({
        eventName: "search_not_found",
        surface: "analysis-panel",
        query: currentValue,
        selectionMethod,
        visibleOptionCount,
        ...searchTelemetryContext,
      });
    }
  };

  const toggleOptions = () => {
    setHasError(false);
    setIsOptionsOpen((current) => !current);
    if (!isTouchScreen()) inputRef.current?.focus();
  };

  const handleOptionSelect = (
    option: string,
    selectionMethod: SearchSelectionMethod,
  ) => {
    onSearch(option, {
      selectionMethod,
      visibleOptionCount: filteredSearchOptions.length,
    });
    // Escolher um local encerra a busca: o nome fica no campo e o teclado
    // fecha, para a análise aparecer sem nada por cima.
    setValue(option);
    setHasError(false);
    setIsOptionsOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="w-full flex gap-2 items-start h-10">
      <div ref={containerRef} className="relative flex-1 flex flex-col h-full">
        <div
          className={`w-full px-2.5 py-3 flex items-center rounded-lg shadow-sm bg-[#E4E5E2] overflow-hidden transition border
                    ${
                      hasError
                        ? "border-red-500 ring-2 ring-red-500"
                        : "hover:border-neutral-400 border-transparent focus-within:border-neutral-600 focus-within:ring-2 focus-within:ring-neutral-600"
                    }
                `}
        >
          <Icon
            id="loupe"
            className="mr-1.5 shrink-0"
            fill="#6F6F6F"
            size={16}
          />

          <input
            ref={inputRef}
            value={value}
            onChange={(event) => {
              const nextValue = event.target.value;

              setValue(nextValue);
              setHasError(false);
              setIsOptionsOpen(nextValue.trim().length > 0);
            }}
            // Tocar no campo com um local já escolhido seleciona o nome, e
            // digitar já começa uma busca nova.
            onFocus={(event) => event.target.select()}
            onKeyDown={(e) => {
              if (
                handleComboboxInputKey(
                  e.key,
                  listRef.current,
                  isOptionsOpen,
                  setIsOptionsOpen,
                )
              ) {
                e.preventDefault();
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (filteredSearchOptions.length > 0) {
                  handleOptionSelect(filteredSearchOptions[0], "enter");
                } else {
                  onSubmit("enter");
                }
              }
            }}
            role="combobox"
            aria-label={t("placeholder")}
            aria-invalid={hasError}
            aria-autocomplete="list"
            aria-controls="platform-searchbar-state-options"
            aria-expanded={isOptionsOpen}
            aria-haspopup="listbox"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full min-w-0 text-ellipsis text-[#292829] text-[0.8125rem] placeholder:text-[0.8125rem] bg-transparent border-none outline-none ring-0"
            placeholder={t("placeholder")}
          />

          <button
            type="button"
            aria-label={t("showOptions")}
            onClick={toggleOptions}
            className="ml-1 shrink-0 text-[#6F6F6F] transition-transform"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`transition-transform ${isOptionsOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              <path
                d="M5 7.5L10 12.5L15 7.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        {isOptionsOpen && (
          <div
            ref={listRef}
            id="platform-searchbar-state-options"
            role="listbox"
            tabIndex={-1}
            onKeyDown={(event) =>
              handleComboboxListKeyDown(event, inputRef.current, () =>
                setIsOptionsOpen(false),
              )
            }
            className="absolute top-[calc(100%+8px)] z-20 max-h-64 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg"
          >
            {filteredSearchOptions.length > 0 ? (
              filteredSearchOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={value === option}
                  // O campo continua com o foco até a escolha; sem isso o
                  // teclado do celular fecha no toque e reabre logo depois.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleOptionSelect(option, "option-click")}
                  className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-[#292829] transition hover:bg-[#F6F7F6]"
                >
                  {option}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-neutral-500">
                {t("noResults")}
              </div>
            )}
          </div>
        )}
        {hasError && (
          <p className="text-sm text-red-600 mt-1 absolute -bottom-6">
            {t("error")}
          </p>
        )}
      </div>
      <ButtonUi
        styles="bg-[#646B2D] hover:bg-[#646B2D] text-white text-sm px-2.5 h-full rounded-lg disabled:hover:* active:brightness-95 transition shrink-0"
        label={t("button")}
        onClick={() => onSubmit("button")}
      />
    </div>
  );
};

export default SearchBarPlatform;
