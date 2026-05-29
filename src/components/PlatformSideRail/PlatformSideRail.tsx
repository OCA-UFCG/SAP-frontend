"use client";
import Link from "next/link";
import { Chevron } from "../Chevron/Chevron";
import { Icon } from "../Icon/Icon";
import clsx from "clsx";

export type PlatformSection =
  | "monitoring"
  | "analysis"
  | "analysis-detail"
  | "communication"
  | "logs";

export interface PlatformSideRailProps {
  /** Which section is currently active/selected. */
  activeSection: PlatformSection;
  /** Called when user selects a different section. */
  onSectionChange: (next: PlatformSection) => void;

  /** Controlled state: whether the side panel is currently visible. */
  isPanelOpen: boolean;
  /** Called when user clicks the chevron toggle. */
  onTogglePanel: () => void;

  /** Whether the authenticated viewer can access the logs dashboard. */
  showAuditLink?: boolean;

  className?: string;
}

type PlatformRailItem =
  | {
      kind: "section";
      id: PlatformSection;
      label: string;
      icon: string;
    }
  | {
      kind: "link";
      href: string;
      label: string;
      icon: string;
    };

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
  showAuditLink = false,
  className,
}: PlatformSideRailProps) {
  const items: PlatformRailItem[] = [
    { kind: "section", id: "monitoring", label: "Monitoramento", icon: "eye" },
    { kind: "section", id: "analysis", label: "Análise", icon: "chart" },
    {
      kind: "section",
      id: "communication",
      label: "Comunicação",
      icon: "calendar",
    },
  ];

  if (showAuditLink) {
    items.push({
      kind: "link",
      href: "/platform?view=logs",
      label: "Auditoria",
      icon: "info",
    });
  }

  return (
    <div
      className={clsx(
        "sticky top-16 relative h-[calc(100vh-64px)] w-[140px] shrink-0 self-start",
        className,
      )}
      data-platform-side-rail
    >
      <nav className="flex h-full w-full flex-col border-r border-neutral-200 bg-white px-[16px] pb-[18px] pt-[48px]">
        <div className="w-[114px] flex flex-col">
          {items.map((item, index) => {
            const isActive =
              item.kind === "section"
                ? item.id === activeSection
                : activeSection === "logs";

            const itemContent = (
              <>
                <div className={clsx("flex items-center justify-center")}>
                  <Icon id={item.icon} size={24} />
                </div>

                <div className="text-[12px] leading-[14px] font-medium text-center break-words w-full px-1">
                  {item.label}
                </div>
              </>
            );

            return (
              <div
                key={item.kind === "section" ? item.id : item.href}
                //clsx eh uma função pra montar classes CSS dinamicamente
                className={clsx(
                  "w-full flex flex-col items-center",
                  index !== 0 && "border-t border-[#ECECEC] pt-[24px]",
                  index !== items.length - 1 && "pb-[24px]",
                )}
              >
                {item.kind === "section" ? (
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
                    {itemContent}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={clsx(
                      "w-full h-[88px] flex flex-col items-center justify-center gap-[4px] px-[8px] rounded-lg transition-colors duration-150",
                      isActive
                        ? "bg-[#E1E2B4] text-[#5B612A]"
                        : "text-[#292829] hover:bg-[#F8F7F8]",
                    )}
                  >
                    {itemContent}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {activeSection !== "analysis" && activeSection !== "logs" && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 transition-[right] duration-300 ease-in-out ${isPanelOpen ? "-right-[460px]" : "-right-[39px]"}`}
        >
          <button
            type="button"
            onClick={onTogglePanel}
            className="h-10 w-10 rounded-r-lg border border-neutral-200 bg-white shadow-sm flex items-center justify-center"
          >
            <span className="cursor-pointer text-sm font-bold">
              <Chevron open={isPanelOpen} from="left" to="right" />
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
