"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon/Icon";
import { ButtonUi } from "../ButtonUI/ButtonUI";
import { states, ufs } from "@/utils/constants";
import { normalize } from "@/utils/functions";

interface SearchBarProps {
  onSearch: (value: string) => void;
}

const BRAZIL_OPTION = "Brasil";
const statesNormalized = new Set(Array.from(states).map(normalize));
const ufsNormalized = new Set(Array.from(ufs).map(normalize));
const brazilNormalized = normalize(BRAZIL_OPTION);
const stateOptions = [BRAZIL_OPTION, ...Array.from(states)];

const SearchBarPlatform = ({ onSearch }: SearchBarProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasError, setHasError] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [value, setValue] = useState("");

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

  const validateSearch = (value: string) => {
    const normalizedValue = normalize(value.trim());

    if (
      !(
        normalizedValue === brazilNormalized ||
        statesNormalized.has(normalizedValue) ||
        ufsNormalized.has(normalizedValue)
      )
    ) {
      throw Error("Estado não identificado.");
    }
  };

  const onSubmit = () => {
    const currentValue = value;

    try {
      validateSearch(currentValue);
      setHasError(false);
      setIsOptionsOpen(false);
      onSearch(currentValue);
    } catch {
      setHasError(true);
    }
  };

  const toggleOptions = () => {
    setHasError(false);
    setIsOptionsOpen((current) => !current);
    inputRef.current?.focus();
  };

  const handleOptionSelect = (option: string) => {
    setValue(option);
    setHasError(false);
    setIsOptionsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="w-full flex gap-2 items-start h-10">
      <div ref={containerRef} className="relative flex-1 flex flex-col h-full">
        <div
          className={`w-full px-3 py-3 flex items-center rounded-lg shadow-sm bg-[#E4E5E2] overflow-hidden transition
                    ${
                      hasError
                        ? "border-red-500 ring-2 ring-red-500"
                        : "hover:border-neutral-400 border-transparent focus-within:border-neutral-600 focus-within:ring-2 focus-within:ring-neutral-600"
                    }
                `}
        >
          <Icon id="loupe" className="mr-2 shrink-0" fill="#898989" size={16} />

          <input
            ref={inputRef}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setHasError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSubmit();
              }
            }}
            role="combobox"
            aria-autocomplete="none"
            aria-controls="platform-searchbar-state-options"
            aria-expanded={isOptionsOpen}
            aria-haspopup="listbox"
            className="w-full text-[#292829] text-sm bg-transparent border-none outline-none ring-0"
            placeholder="Pesquise uma cidade ou estado"
          />

          <button
            type="button"
            aria-label="Mostrar estados"
            onClick={toggleOptions}
            className="ml-2 shrink-0 text-[#898989] transition-transform"
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
            id="platform-searchbar-state-options"
            role="listbox"
            className="absolute top-[calc(100%+8px)] z-20 max-h-64 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg"
          >
            {stateOptions.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={value === option}
                onClick={() => handleOptionSelect(option)}
                className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-[#292829] transition hover:bg-[#F6F7F6]"
              >
                {option}
              </button>
            ))}
          </div>
        )}
        {hasError && (
          <p className="text-sm text-red-600 mt-1 absolute -bottom-6">
            Estado não identificado.
          </p>
        )}
      </div>
      <ButtonUi
        styles="bg-[#989F43] hover:bg-[#989F43] text-white text-sm px-3 h-full rounded-lg disabled:hover:* active:brightness-95 transition shrink-0"
        label={"Pesquisar"}
        onClick={() => onSubmit()}
      />
    </div>
  );
};

export default SearchBarPlatform;
