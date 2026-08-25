"use client";

import { useId, type ReactNode } from "react";

interface CatalogActionButtonProps {
  children: ReactNode;
  className: string;
  description: string;
  disabled: boolean;
  onClick: () => void;
}

/** Botão de ação com a explicação do que ele faz visível no hover e no foco. */
export function CatalogActionButton({
  children,
  className,
  description,
  disabled,
  onClick,
}: CatalogActionButtonProps) {
  const descriptionId = useId();

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className={className}
        disabled={disabled}
        aria-describedby={descriptionId}
        onClick={onClick}
      >
        {children}
      </button>
      <span
        id={descriptionId}
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-[calc(100%+0.5rem)] left-0 z-30 w-72 max-w-[calc(100vw-3rem)] rounded-md bg-stone-800 px-3 py-2 text-left text-xs font-normal leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {description}
      </span>
    </span>
  );
}
