"use client";
import { useLinkStatus } from "next/link";
import { Link } from "@/translations/routing";
import { Chevron } from "../Chevron/Chevron";
import { Icon } from "../Icon/Icon";
import { PLATFORM_SHELL_HEIGHT_CLASS } from "@/components/PlatformLayout/platformShell";
import clsx from "clsx";
import { useTranslations } from "next-intl";

export type PlatformSection =
  | "monitoring"
  | "analysis"
  | "analysis-detail"
  | "communication"
  | "logs"
  | "catalog";

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

  /** Seção cuja navegação está em voo, para a trilha dizer que está indo. */
  pendingSection?: PlatformSection | null;

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
      id: "logs" | "catalog";
      href: string;
      label: string;
      icon: string;
    };

function RailPendingSpinner() {
  const t = useTranslations("PlatformSideRail");

  return (
    <span
      role="status"
      aria-label={t("loading")}
      className="h-6 w-6 animate-spin rounded-full border-2 border-[#E1E2B4] border-t-[#777E32]"
    />
  );
}

function RailItemContent({
  icon,
  label,
  isPending,
}: {
  icon: string;
  label: string;
  isPending: boolean;
}) {
  return (
    <>
      <div className="flex items-center justify-center">
        {isPending ? <RailPendingSpinner /> : <Icon id={icon} size={24} />}
      </div>

      <div className="text-[12px] leading-[14px] font-medium text-center break-words w-full px-1">
        {label}
      </div>
    </>
  );
}

/**
 * Auditoria e catálogo são links de verdade, e o Next avisa quando a navegação
 * daquele link está em voo. Sem isso a trilha fica parada por perto de um
 * segundo depois do clique, sem sinal nenhum de que algo aconteceu.
 */
function RailLinkContent({ icon, label }: { icon: string; label: string }) {
  const { pending } = useLinkStatus();

  return <RailItemContent icon={icon} label={label} isPending={pending} />;
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
  showAuditLink = false,
  pendingSection = null,
  className,
}: PlatformSideRailProps) {
  const t = useTranslations("PlatformSideRail");

  const items: PlatformRailItem[] = [
    { kind: "section", id: "monitoring", label: t("monitoring"), icon: "eye" },
    {
      kind: "section",
      id: "communication",
      label: t("communication"),
      icon: "calendar",
    },
    { kind: "section", id: "analysis", label: t("analysis"), icon: "chart" },
  ];

  if (showAuditLink) {
    items.push({
      kind: "link",
      id: "logs",
      href: "/platform?view=logs",
      label: t("logs"),
      icon: "info",
    });
    items.push({
      kind: "link",
      id: "catalog",
      href: "/platform?view=catalog",
      label: t("catalog"),
      icon: "chart",
    });
  }

  return (
    <div
      className={clsx(
        // `top-16.5` acompanha a altura real do cabeçalho; `max-h-full` impede
        // que a trilha ultrapasse a casca e invada o rodapé nas telas que rolam.
        `sticky top-16.5 relative max-h-full w-[140px] shrink-0 self-start ${PLATFORM_SHELL_HEIGHT_CLASS}`,
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
                : activeSection === item.id;

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
                    aria-busy={pendingSection === item.id || undefined}
                    className={clsx(
                      "cursor-pointer w-full h-[88px] flex flex-col items-center justify-center gap-[4px] px-[8px] rounded-lg transition-colors duration-150",
                      isActive
                        ? "bg-[#E1E2B4] text-[#5B612A]"
                        : "text-[#292829] hover:bg-[#F8F7F8]",
                    )}
                  >
                    <RailItemContent
                      icon={item.icon}
                      label={item.label}
                      isPending={pendingSection === item.id}
                    />
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
                    <RailLinkContent icon={item.icon} label={item.label} />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {activeSection !== "analysis" &&
        activeSection !== "logs" &&
        activeSection !== "catalog" && (
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
