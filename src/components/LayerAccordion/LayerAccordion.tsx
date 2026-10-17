"use client";

import React, { useId, useState } from "react";
import { Chevron } from "@/components/Chevron/Chevron";

interface LayerAccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** Modo controlado: quem monta o acordeão guarda o aberto/fechado. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Padding horizontal do cabeçalho, para alinhar a seta com a de vizinhos. */
  headerPaddingClassName?: string;
}

export function LayerAccordion({
  title,
  children,
  defaultOpen = false,
  open,
  onOpenChange,
  headerPaddingClassName = "px-4",
}: LayerAccordionProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = open ?? uncontrolledOpen;
  const contentId = useId();

  const toggle = () => {
    const next = !isOpen;
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div
      className={`flex flex-col w-full bg-white hover:bg-[#E4E5E2] border rounded-lg transition-[background-color,border-color,box-shadow] duration-200 ${
        isOpen ? "border-[#E1E2B4] shadow-sm" : "border-[#EFEFEF]"
      }`}
    >
      <button
        type="button"
        onClick={toggle}
        className={`group flex flex-row items-center w-full ${headerPaddingClassName} py-4 gap-[18px] text-left bg-transparent`}
        style={{ height: 56 }}
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        <span
          className="flex-1 text-base font-medium text-[#0F172A] transition-[translate] duration-200 ease-out motion-safe:group-hover:translate-x-1"
          style={{ fontFamily: "Inter" }}
        >
          {title}
        </span>
        {/* A seta ganha um círculo verde no hover, como um botão de verdade. */}
        <span
          className={`-m-1.5 flex size-7 shrink-0 items-center justify-center rounded-full transition-colors duration-200 group-hover:bg-[#E1E2B4] group-hover:text-[#5B612A] ${
            isOpen ? "bg-[#F5F6EE] text-[#5B612A]" : ""
          }`}
        >
          <Chevron open={isOpen} from="down" to="up" size={16} />
        </span>
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
          id={contentId}
          inert={!isOpen}
          className={`overflow-hidden flex flex-col gap-6 px-4 pt-1 ${isOpen ? "accordion-cascade" : ""}`}
        >
          <hr className="w-full border-t border-[#EFEFEF]" />
          {children}
        </div>
      </div>
    </div>
  );
}
