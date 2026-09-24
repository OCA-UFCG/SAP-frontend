"use client";

import React, { useState } from "react";
import { Chevron } from "@/components/Chevron/Chevron";

interface LayerAccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** Modo controlado: quem monta o acordeão guarda o aberto/fechado. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * "subgroup" é o subacordeão dentro de uma categoria: cabeçalho mais baixo e
   * título menor, para ler como parte da categoria e não como uma categoria nova.
   */
  variant?: "category" | "subgroup";
}

const HEADER_STYLE = {
  category: { height: 56, title: "text-base font-medium" },
  subgroup: { height: 48, title: "text-sm font-semibold" },
} as const;

export function LayerAccordion({
  title,
  children,
  defaultOpen = false,
  open,
  onOpenChange,
  variant = "category",
}: LayerAccordionProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = open ?? uncontrolledOpen;
  const headerStyle = HEADER_STYLE[variant];

  const toggle = () => {
    const next = !isOpen;
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div className="flex flex-col w-full bg-white hover:bg-[#E4E5E2] border border-[#EFEFEF] rounded-lg transition-colors duration-150">
      <button
        type="button"
        onClick={toggle}
        className="flex flex-row items-center w-full px-4 py-4 gap-[18px] text-left bg-transparent"
        style={{ height: headerStyle.height }}
        aria-expanded={isOpen}
      >
        <span
          className={`flex-1 ${headerStyle.title} text-[#0F172A]`}
          style={{ fontFamily: "Inter" }}
        >
          {title}
        </span>
        <Chevron open={isOpen} from="down" to="up" size={16} />
      </button>

      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen
            ? "grid-rows-[1fr] opacity-100 pb-4"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        {/* Fechado, o conteúdo continua montado (para não perder estado), então
            `inert` é o que impede o Tab de parar em campos invisíveis. */}
        <div
          inert={!isOpen}
          className="overflow-hidden flex flex-col gap-6 px-4 pt-1"
        >
          <hr className="w-full border-t border-[#EFEFEF]" />
          {children}
        </div>
      </div>
    </div>
  );
}
