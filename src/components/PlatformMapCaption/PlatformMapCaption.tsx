"use client";

import { useState } from "react";
import { Chevron } from "../Chevron/Chevron";

/**
 * PlatformMapCaption
 *
 * Placeholder for the map legend/caption overlay (bottom-right).
 *
 * This is intentionally minimal for now; the goal is to make the planned
 * component hierarchy explicit.
 */
export function PlatformMapCaption() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute bottom-6 right-6 w-[280px] rounded-lg border border-neutral-200 bg-white/90 shadow-sm">
      <div
        className={`
        ${isOpen ? "px-4 pt-1 pb-4 gap-4" : "px-4 py-3 gap-[10px]"}
        bg-white hover:bg-[#E4E5E2]
        border border-[#EFEFEF] rounded-lg transition-colors duration-150
      `}
      >
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex justify-between items-center w-full cursor-pointer text-left bg-transparent"
          aria-expanded={isOpen}
        >
          <p className="text-xs font-semibold text-neutral-700">
            PlatformMapCaption
          </p>
          <Chevron open={isOpen} from="down" to="up" />
        </button>
      </div>
      <div>
        {isOpen && (
          <>
            <div className="mt-1 text-[11px] text-neutral-500">
              Legend / caption overlay placeholder
            </div>
          </>
        )}
      </div>
    </div>
  );
}
