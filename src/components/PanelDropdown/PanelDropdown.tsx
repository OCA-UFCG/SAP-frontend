"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface PanelDropdownOption {
  value: string;
  label: string;
}

/**
 * O dropdown de recorte do painel. Monitoramento e Comunicação usam o mesmo
 * componente porque são o mesmo controle para o usuário: mudar o `<select>`
 * nativo de um lado fazia a seta e a altura saírem diferentes do outro.
 *
 * @example
 * <PanelDropdown label="Recorte" options={scopes} value={scope} onChange={setScope} />
 */
export function PanelDropdown({
  label,
  labelledBy,
  ariaLabelPrefix,
  options,
  value,
  placeholder,
  onChange,
}: {
  /** Rótulo visível acima do controle. Omita quando um rótulo externo cobre os dois dropdowns da linha. */
  label?: string;
  /** Id do rótulo externo, para o `aria-labelledby` da lista. */
  labelledBy?: string;
  /** Prefixo do nome acessível do botão; use quando o rótulo visível é externo. */
  ariaLabelPrefix?: string;
  options: readonly PanelDropdownOption[];
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const generatedId = useId();
  const labelId = labelledBy ?? `${generatedId}-label`;
  const optionsId = `${generatedId}-options`;

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node))
        setIsOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isOpen]);

  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? placeholder;

  return (
    <div
      ref={containerRef}
      className="flex min-w-0 flex-1 flex-col items-start gap-[6px]"
    >
      {label && (
        <span
          id={labelId}
          className="text-[14px] font-medium leading-[20px] text-[#292829]"
        >
          {label}
        </span>
      )}
      <div className="relative w-full">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="flex h-10 w-full items-center justify-between rounded-lg border border-transparent bg-[#E4E5E2] px-3 py-3 text-left text-sm shadow-sm transition hover:border-neutral-400 focus-visible:border-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-600"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={optionsId}
          aria-label={`${ariaLabelPrefix ?? label ?? placeholder}: ${selectedLabel}`}
        >
          <span className="truncate text-[#292829]">{selectedLabel}</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            className={`ml-2 shrink-0 text-[#898989] transition-transform ${isOpen ? "rotate-180" : ""}`}
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
        {isOpen && (
          <div
            id={optionsId}
            role="listbox"
            aria-labelledby={labelId}
            className="absolute top-[calc(100%+8px)] z-30 max-h-64 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg"
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  setIsOpen(false);
                  onChange(option.value);
                }}
                className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-[#292829] transition hover:bg-[#F6F7F6]"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
