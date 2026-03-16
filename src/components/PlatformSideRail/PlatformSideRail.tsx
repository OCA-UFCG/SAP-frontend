    "use client";

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
    const items: Array<{ id: PlatformSection; label: string }> = [
        { id: "modules", label: "Módulos" },
        { id: "analysis", label: "Análise Multicritério" },
        { id: "forecast", label: "Previsão" },
    ];

    return (
        <div className={clsx("relative h-full", className)}>
        <nav className="h-full w-[124px] bg-white border-r border-neutral-200 px-4 py-8 flex flex-col gap-3">
            {items.map((item) => {
            const isActive = item.id === activeSection;

            return (
                <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={clsx(
                    "w-full rounded-lg px-3 py-4 text-left transition-colors",
                    isActive
                    ? "bg-[#E1E2B4] text-[#5B612A]"
                    : "bg-white text-neutral-700 hover:bg-neutral-50",
                )}
                >
                {/* Icon placeholder */}
                <div
                    className={clsx(
                    "h-9 w-9 rounded-md border flex items-center justify-center text-xs font-semibold",
                    isActive
                        ? "border-[#5B612A]/30 bg-white"
                        : "border-neutral-200 bg-white",
                    )}
                >
                    {item.label.slice(0, 1)}
                </div>

                <div className="mt-2 text-xs font-medium">{item.label}</div>
                </button>
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
