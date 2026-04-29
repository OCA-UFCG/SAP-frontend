"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon/Icon";
import { ButtonUi } from "../ButtonUI/ButtonUI";
import {
  stateOptions,
  validateSearch,
  filterStateOptions,
} from "./searchBarUtils";

interface SearchBarProps {
  onSearch: (value: string) => void;
}

const SearchBar = ({ onSearch }: SearchBarProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasError, setHasError] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [value, setValue] = useState("");

  const filteredStateOptions = filterStateOptions(value);

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
    onSearch(option);
    setValue("");
    setHasError(false);
    setIsOptionsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="w-full flex justify-between gap-5 items-start h-14">
      <div ref={containerRef} className="relative flex-1 flex flex-col h-full">
        <div
          className={`min-w-40 w-full p-4 flex items-center text-lg rounded-xl shadow-sm bg-[#E4E5E2] overflow-hidden transition border
                    ${
                      hasError
                        ? "border-red-500 ring-2 ring-red-500"
                        : "hover:border-neutral-400 border-transparent focus-within:border-neutral-600 focus-within:ring-2 focus-within:ring-neutral-600"
                    }
                `}
        >
          <Icon id="loupe" className="mr-4" fill="#292829" size={24} />

          <input
            ref={inputRef}
            value={value}
            onChange={(event) => {
              const nextValue = event.target.value;

              setValue(nextValue);
              setHasError(false);
              setIsOptionsOpen(nextValue.trim().length > 0);
            }}
            role="combobox"
            aria-autocomplete="list"
            aria-controls="searchbar-state-options"
            aria-expanded={isOptionsOpen}
            aria-haspopup="listbox"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (filteredStateOptions.length === 1) {
                  handleOptionSelect(filteredStateOptions[0]);
                } else {
                  onSubmit();
                }
              }
            }}
            className="w-full text-[#292829] bg-transparent border-none outline-none ring-0"
            placeholder="Pesquise um estado"
          />

          <button
            type="button"
            aria-label="Mostrar estados"
            onClick={toggleOptions}
            className="ml-3 shrink-0 text-[#292829] transition-transform"
          >
            <svg
              width="18"
              height="18"
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
            id="searchbar-state-options"
            role="listbox"
            className="absolute top-[calc(100%+8px)] z-20 max-h-64 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg"
          >
            {filteredStateOptions.map((option) => (
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
        {/* Home: keep red border on error but do not show inline error message */}
      </div>
      <ButtonUi
        // disabled={!search}
        styles="bg-[#989F43] text-white min-w-30 h-full rounded-xl hover:brightness-110 active:brightness-95 transition not:disabled:hover:opacity-90 disabled:hover:opacity-100 hover:bg-[#989F43]"
        label={"Pesquisar"}
        onClick={() => onSubmit()}
      />
    </div>
  );
};

export default SearchBar;
