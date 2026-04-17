"use client";

import { useState } from "react";
import { Chevron } from "../Chevron/Chevron";
import { IImageParam } from "@/utils/interfaces";

/**
 * PlatformMapCaption
 *
 * Placeholder for the map legend/caption overlay (bottom-right).
 *
 * This is intentionally minimal for now; the goal is to make the planned
 * component hierarchy explicit.
 */
export function PlatformMapCaption({ legend }: { legend: IImageParam[] }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className={'z-[1000] absolute bottom-6 right-6 w-[340px] rounded-xl border-t border-neutral-200 bg-white/90 shadow-sm'}>
      <div
        className={`
        ${isOpen ? "px-4 py-3 gap-[10px]" : "px-4 py-3 gap-[10px]"}
        bg-white hover:bg-[#E4E5E2]
        border border-[#EFEFEF] rounded-lg transition-colors duration-150
      `}
      >
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full h-full justify-between items-center w-full cursor-pointer text-left bg-transparent"
          aria-expanded={isOpen}
        >
          <h2 className="font-semibold text-base text-neutral-600">Legendas</h2>
          <Chevron open={isOpen} from="down" to="up" size={30} />
        </button>
      </div>
      <div>
        <div
          className={`
            overflow-hidden rounded-b-xl
            transition-all duration-400 ease-in-out
            ${isOpen ? "max-h-96 opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-0"}
          `}
        >
          <div className="bg-white border-neutral-200 px-4 py-4">
            <div className="flex flex-col gap-3">
              {legend.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3"
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-black leading-none text-[#333333]">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
