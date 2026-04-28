"use client";
import { Chevron } from "../Chevron/Chevron";
import { Icon } from "../Icon/Icon";
import clsx from "clsx";

export type PlatformSection =
  | "monitoring"
  | "analysis"
  | "analysis-detail"
  | "communication";

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
  const items: Array<{ id: PlatformSection; label: string; icon: string }> = [
    { id: "monitoring", label: "Monitoramento", icon: "eye" },
    { id: "analysis", label: "Análise", icon: "chart" },
    { id: "communication", label: "Comunicação", icon: "calendar" },
  ];

  return (
    <div className={clsx("relative h-full", className)} data-platform-side-rail>
      <nav className="h-full w-[140px] bg-white border-r border-neutral-200 pt-[48px] pb-[18px] px-[16px] flex flex-col">
        <div className="w-[114px] flex flex-col">
          {items.map((item, index) => {
            const isActive = item.id === activeSection;
            return (
              <div
                key={item.id}
                //clsx eh uma função pra montar classes CSS dinamicamente
                className={clsx(
                  "w-full flex flex-col items-center",
                  index !== 0 && "border-t border-[#ECECEC] pt-[24px]",
                  index !== items.length - 1 && "pb-[24px]",
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
                      : "text-[#292829] hover:bg-[#F8F7F8]",
                  )}
                >
                  <div className={clsx("flex items-center justify-center")}>
                    <Icon id={item.icon} size={24} />
                  </div>

                  <div className="text-[12px] leading-[14px] font-medium text-center break-words w-full px-1">
                    {item.label}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </nav>

      {/* Panel toggle handle (chevron placeholder) */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 transition-[right] duration-300 ease-in-out ${isPanelOpen ? "-right-[460px]" : "-right-[39px]"}`}
      >
        <button
          type="button"
          onClick={onTogglePanel}
          className="h-10 w-10 rounded-r-lg border border-neutral-200 bg-white shadow-sm flex items-center justify-center"
        >
          <span className="cursor-pointer text-sm font-bold">
            <Chevron open={isPanelOpen} from="right" to="left" />
          </span>
        </button>
      </div>
    </div>
  );
}
