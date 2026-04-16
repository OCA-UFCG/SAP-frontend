"use client";

import { useRef, useState } from "react";
import { Icon } from "../Icon/Icon";
import { ButtonUi } from "../ButtonUI/ButtonUI";
import { states, ufs } from "@/utils/constants";

interface SearchBarProps {
    onSearch: (value: string) => void;
}

function normalize(str: string): string {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").trim();
}

const statesNormalized = new Set(Array.from(states).map(normalize));
const ufsNormalized = new Set(Array.from(ufs).map(normalize));

const SearchBarPlatform = ({ onSearch }: SearchBarProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [hasError, setHasError] = useState(false);

    const validateSearch = (value: string) => {

        if (!(states.has(value.trim()) || ufs.has(value.trim()))) {
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
        <div className="w-full flex gap-2 items-start h-10">
            <div className="relative flex-1 flex flex-col h-full">
                <div
                    className={`w-full px-3 py-3 flex items-center rounded-lg shadow-sm bg-[#E4E5E2] overflow-hidden transition
                    ${hasError
                            ? "border-red-500 ring-2 ring-red-500"
                            : "hover:border-neutral-400 border-transparent focus-within:border-neutral-600 focus-within:ring-2 focus-within:ring-neutral-600"
                        }
                `}
                >
                    <Icon id="loupe" className="mr-2 shrink-0" fill="#898989" size={16} />

                    <input
                        ref={inputRef}
                        onChange={() => setHasError(false)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                onSubmit();
                            }
                        }}
                        list="result"
                        className="w-full text-[#292829] text-sm bg-transparent border-none outline-none ring-0"
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
                styles="bg-[#989F43] hover:bg-[#989F43] text-white text-sm px-3 h-full rounded-lg disabled:hover:* active:brightness-95 transition shrink-0"
                label={"Pesquisar"}
                onClick={() => onSubmit()}
            />
        </div>
    );
};

export default SearchBarPlatform;
