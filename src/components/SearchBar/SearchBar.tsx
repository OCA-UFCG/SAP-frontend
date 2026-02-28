"use client";

import { useRef, useState } from "react";
import { Icon } from "../Icon/Icon";
import { ButtonUi } from "../ButtonUI/ButtonUI";
import { normalize } from "@/utils/functions";
import { states, ufs } from "@/utils/constants";

interface SearchBarProps {
  onSearch: (value: string) => void;
}

const SearchBar = ({ onSearch }: SearchBarProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasError, setHasError] = useState(false);

  const validateSearch = (value: string) => {
    const normalizedValue = normalize(value.trim());

    if (!(states.has(normalizedValue) || ufs.has(normalizedValue))) {
      throw Error("Estado não identificado.");
    }
  };

  const onSubmit = () => {
    const value = inputRef.current?.value || "";

    try {
      validateSearch(value);
    } catch {
      setHasError(true);
    } finally {
      onSearch(value);
    }
  };

  return (
    <div className="w-full flex justify-between gap-5 items-start h-14">
      <div className="relative flex-1 flex flex-col h-full">
        <div
          className={`min-w-90 w-full p-4 flex items-center text-lg rounded-xl shadow-sm bg-[#E4E5E2] overflow-hidden transition
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
            onChange={() => setHasError(false)}
            list="result"
            className="w-full text-[#292829] bg-transparent border-none outline-none ring-0"
            placeholder="Pesquise uma cidade ou estado"
          />

          <datalist id="result">
            {Array.from(states).map((result, i) => {
              return (
                <option key={i} value={result}>
                  {result}
                </option>
              );
            })}
          </datalist>
        </div>
        {hasError && (
          <p className="text-sm text-red-600 mt-1 absolute -bottom-6">
            Estado não identificado.
          </p>
        )}
      </div>
      <ButtonUi
        // disabled={!search}
        styles="bg-[#989F43] text-white w-full min-w-30 h-full rounded-xl hover:brightness-110 active:brightness-95 transition not:disabled:hover:opacity-90 disabled:hover:opacity-100 hover:bg-[#989F43]"
        label={"Pesquisar"}
        onClick={() => onSubmit()}
      />
    </div>
  );
};

export default SearchBar;
