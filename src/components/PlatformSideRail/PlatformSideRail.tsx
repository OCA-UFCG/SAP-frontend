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
        <nav className="h-full w-31 bg-white border-r border-neutral-200 px-4 py-8 flex flex-col gap-3">
            {items.map((item, index) => {
  const isActive = item.id === activeSection;
  const nextIsActive = items[index + 1]?.id === activeSection;
  const showSeparator = !isActive && !nextIsActive && index < items.length - 1;

  return (
    <div key={item.id}>
      <button
        type="button"
        onClick={() => onSectionChange(item.id)}
        aria-current={isActive ? "page" : undefined}
        className={clsx(
          "w-full rounded-xl px-2 py-5 text-center transition-colors",
          isActive
            ? "bg-[#E1E2B4] text-[#5B612A]"
            : "bg-white text-neutral-400 hover:text-neutral-600",
        )}
      >
        <div className="flex items-center justify-center">
          <Icon id={item.icon} size={22} />
        </div>
        <div className="mt-2 text-xs font-medium text-center leading-tight break-words">
          {item.label}
        </div>
      </button>

      {showSeparator && <hr className="border-neutral-200 mx-2" />}
    </div>
  );
})}
            </nav>

            {/* Panel toggle handle (chevron placeholder) */}
            <div className="absolute top-1/2 -right-5 -translate-y-1/2">
                <button
                type="button"
                onClick={onTogglePanel}
                aria-label={isPanelOpen ? "Collapse side panel" : "Expand side panel"}
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
