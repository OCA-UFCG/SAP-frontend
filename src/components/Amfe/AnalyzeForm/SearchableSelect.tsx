"use client";

import { useEffect, useRef, useState } from "react";
import { text as textColor } from "@/utils/amfeConsts";

interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  emptyMessage?: string;
}

const SearchableSelect = ({
  options,
  value,
  onChange,
  onBlur,
  placeholder,
  emptyMessage,
}: SearchableSelectProps) => {
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? "";
  const query = draft ?? selectedLabel;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setDraft(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const handleSelect = (option: SearchableSelectOption) => {
    onChange(option.value);
    setDraft(null);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        handleSelect(filteredOptions[0]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setDraft(null);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        className="w-full rounded-xl border bg-white px-5 py-4 font-medium"
        style={{ borderColor: "rgba(0,0,0,0.08)", color: textColor }}
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
      />
      {open && (
        <div
          className="absolute z-[1000] mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-white shadow-lg"
          style={{ borderColor: "rgba(0,0,0,0.08)" }}
        >
          {filteredOptions.length === 0 ? (
            <p className="px-5 py-3 text-sm opacity-60">{emptyMessage}</p>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className="block w-full cursor-pointer px-5 py-3 text-left hover:bg-gray-50"
                onClick={() => handleSelect(option)}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
