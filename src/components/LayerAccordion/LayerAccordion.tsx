"use client";

import React, { useState } from "react";
import { Chevron } from "@/components/Chevron/Chevron";

interface LayerAccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function LayerAccordion({ title, children, defaultOpen = false }: LayerAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="flex flex-col w-full bg-white hover:bg-[#E4E5E2] border border-[#EFEFEF] rounded-lg transition-colors duration-150">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex flex-row items-center w-full px-4 py-4 gap-[18px] text-left bg-transparent"
        style={{ height: 56 }}
        aria-expanded={isOpen}
      >
        <span
          className="flex-1 text-base font-medium text-[#0F172A]"
          style={{ fontFamily: "Inter" }}
        >
          {title}
        </span>
        <Chevron open={isOpen} from="up" to="down" size={16} />
      </button>

      <div
        className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100 pb-4" : "grid-rows-[0fr] opacity-0"
          }`}
      >
        <div className="overflow-hidden flex flex-col gap-6 px-4 pt-1">
          <hr className="w-full border-t border-[#EFEFEF]" />
          {children}
        </div>
      </div>
    </div>
  );
}
