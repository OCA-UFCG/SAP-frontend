"use client";
import { Icon } from "../Icon/Icon";
import clsx from "clsx";

export type PlatformSection = "modules" | "analysis" | "forecast";

export interface PlatformSideRailProps {
  /** Which section is currently active/selected. */
  activeSection: PlatformSection;
  /** Called when user selects a different section. */
  onSectionChange: (next: PlatformSection) => void;

  /** Controlled state: whether the side panel is currently visible. */
  isPanelOpen: boolean;
  /** Called when user clicks the chevron toggle. */
  onTogglePanel: () => void;

  className?: string;
}

/**
 * PlatformSideRail
 *
 * The narrow vertical navigation rail (icons + labels).
 *
 * Note about panel toggle:
 * - This component does NOT depend on PlatformSidePanel existing.
 * - It only *emits intent* via `onTogglePanel()` and reflects `isPanelOpen`.
 * - The parent container (PlatformSidebar) decides whether to render the panel.
 */
export function PlatformSideRail({
  activeSection,
  onSectionChange,
  isPanelOpen,
  onTogglePanel,
  className,
}: PlatformSideRailProps) {
    const items: Array<{ id: PlatformSection; label: string, icon: string }> = [
      { id: "modules", label: "Módulos", icon: "eye" },
      { id: "analysis", label: "Análise Multicritério", icon: "chart" },
      { id: "forecast", label: "Previsão", icon: "calendar" },
  ];

  return (
    <div className={clsx("relative h-full", className)}>
      <nav className="h-full w-[124px] bg-white border-r border-neutral-200 pt-[48px] pb-[18px] px-[16px] flex flex-col">
        <div className="w-[92px] flex flex-col">

          {items.map((item, index) => {
            const isActive = item.id === activeSection;
            return (
            <div
              key={item.id}
              //clsx eh uma função pra montar classes CSS dinamicamente
              className={clsx(
                "w-full flex flex-col items-center",
                index !== 0 && "border-t border-[#ECECEC] pt-[24px]",
                index !== items.length - 1 && "pb-[24px]"
              )}
            >
                <button
                  type="button"
                  onClick={() => onSectionChange(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={clsx(
                    "cursor-pointer w-full h-[88px] flex flex-col items-center justify-center gap-[4px] px-[8px] rounded-lg transition-colors duration-150",
                    isActive
                ? "bg-[#E1E2B4] text-[#5B612A]"
                : "text-[#292829] hover:bg-[#F8F7F8]"
                  )}
                >
                  <div
                    className={clsx(
                      "flex items-center justify-center",
                    )}
                  >
                    <Icon id={item.icon} size={24} />
                  </div>

                  <div className="text-[12px] leading-[14px] font-medium text-center break-words w-[76px]">
                    {item.label}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </nav>

      {/* Panel toggle handle (chevron placeholder) */}
      <div className="absolute top-1/2 -right-5 -translate-y-1/2">
        <button
          type="button"
          onClick={onTogglePanel}
          className="h-10 w-10 rounded-r-lg border border-neutral-200 bg-white shadow-sm flex items-center justify-center"
        >
          <span className="text-sm font-bold">
            {isPanelOpen ? "<" : ">"}
          </span>
        </button>
      </div>
    </div>
  );
}