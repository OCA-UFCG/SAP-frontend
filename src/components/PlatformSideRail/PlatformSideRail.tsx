"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { createPortal } from "react-dom";
import { useLinkStatus } from "next/link";
import { Link } from "@/translations/routing";
import { Chevron } from "../Chevron/Chevron";
import { Icon } from "../Icon/Icon";
import { PLATFORM_SHELL_HEIGHT_CLASS } from "@/components/PlatformLayout/platformShell";
import { APPROVALS_PATH } from "@/config/accessRoutes";
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
  /** O mouse ou o foco chegou no item, antes do clique. */
  onSectionIntent?: (next: PlatformSection) => void;

  /** Controlled state: whether the side panel is currently visible. */
  isPanelOpen: boolean;
  /** Called when user clicks the chevron toggle. */
  onTogglePanel: () => void;

  /** Whether the authenticated viewer can access the logs dashboard. */
  showAuditLink?: boolean;

  /** Seção cuja navegação está em voo, para a trilha dizer que está indo. */
  pendingSection?: PlatformSection | null;

  /** Reabre o tutorial da plataforma. Sem ele, o botão "Tutorial" não aparece. */
  onReplayTour?: () => void;

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
      id: "logs" | "catalog" | "approvals";
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

/**
 * Quantos pedidos de acesso esperam decisão. Busca depois que a trilha aparece,
 * e não junto com a plataforma, para a conta nunca atrasar a abertura do mapa.
 * Falhar aqui só esconde o número: a tela de aprovação continua a um clique.
 */
function usePendingApprovalsCount(enabled: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    fetch("/api/signup/pending-count", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { count?: unknown } | null) => {
        if (active && typeof body?.count === "number") setCount(body.count);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [enabled]);

  return count;
}

/**
 * O gesto de cada ícone no hover e quando a seção é escolhida: o balão de
 * conversa balança e o alvo pulsa. Os demais pulsam; o olho pisca, em
 * `BlinkingEyeIcon`.
 */
const ICON_GESTURE: Record<string, string> = {
  "chat-bubble": "motion-safe:group-hover:animate-[icon-wiggle_600ms_ease-in-out]",
  target: "motion-safe:group-hover:animate-[icon-pulse_550ms_ease-in-out]",
};
const DEFAULT_ICON_GESTURE =
  "motion-safe:group-hover:animate-[icon-pulse_550ms_ease-in-out]";

const ICON_GESTURE_ON_SELECT: Record<string, string> = {
  "chat-bubble": "motion-safe:animate-[icon-wiggle_600ms_ease-in-out]",
  target: "motion-safe:animate-[icon-pulse_550ms_ease-in-out]",
};
const DEFAULT_ICON_GESTURE_ON_SELECT =
  "motion-safe:animate-[icon-pulse_550ms_ease-in-out]";

/**
 * O olho de Monitoramento desenhado aqui, e não pelo sprite, para poder piscar:
 * o contorno e a pupila achatam até sumir enquanto uma linha reta aparece no
 * meio, como a pálpebra fechada, e depois o olho abre de novo.
 */
function BlinkingEyeIcon({ blinkNow }: { blinkNow: boolean }) {
  const close = blinkNow
    ? "motion-safe:animate-[eye-close_500ms_ease-in-out]"
    : "motion-safe:group-hover:animate-[eye-close_500ms_ease-in-out]";
  const lid = blinkNow
    ? "motion-safe:animate-[eye-lid_500ms_ease-in-out]"
    : "motion-safe:group-hover:animate-[eye-lid_500ms_ease-in-out]";

  return (
    <svg width={24} height={24} viewBox="0 0 22 15" aria-hidden>
      <path
        className={clsx("origin-center [transform-box:fill-box]", close)}
        d="M11 2C14.79 2 18.17 4.13 19.82 7.5C18.17 10.87 14.8 13 11 13C7.2 13 3.83 10.87 2.18 7.5C3.83 4.13 7.21 2 11 2ZM11 0C6 0 1.73 3.11 0 7.5C1.73 11.89 6 15 11 15C16 15 20.27 11.89 22 7.5C20.27 3.11 16 0 11 0ZM11 5C12.38 5 13.5 6.12 13.5 7.5C13.5 8.88 12.38 10 11 10C9.62 10 8.5 8.88 8.5 7.5C8.5 6.12 9.62 5 11 5ZM11 3C8.52 3 6.5 5.02 6.5 7.5C6.5 9.98 8.52 12 11 12C13.48 12 15.5 9.98 15.5 7.5C15.5 5.02 13.48 3 11 3Z"
        fill="currentColor"
      />
      <line
        className={clsx("opacity-0", lid)}
        x1={1}
        y1={7.5}
        x2={21}
        y2={7.5}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function RailBadge({ count }: { count: number }) {
  const t = useTranslations("PlatformSideRail");

  return (
    <span
      aria-label={t("pendingApprovals", { count })}
      className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#B3261E] px-1 text-[10px] font-semibold leading-none text-white"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function RailItemContent({
  icon,
  label,
  isPending,
  isActive = false,
  badge = 0,
}: {
  icon: string;
  label: string;
  isPending: boolean;
  isActive?: boolean;
  badge?: number;
}) {
  return (
    <>
      <div className="relative flex items-center justify-center">
        {isPending ? (
          <RailPendingSpinner />
        ) : icon === "eye" ? (
          <span className="flex transition-[translate] duration-300 ease-out group-hover:-translate-y-0.5">
            <BlinkingEyeIcon blinkNow={isActive} />
          </span>
        ) : (
          <span
            className={clsx(
              "flex transition-[translate] duration-300 ease-out group-hover:-translate-y-0.5",
              isActive
                ? (ICON_GESTURE_ON_SELECT[icon] ??
                    DEFAULT_ICON_GESTURE_ON_SELECT)
                : (ICON_GESTURE[icon] ?? DEFAULT_ICON_GESTURE),
            )}
          >
            <Icon id={icon} size={24} />
          </span>
        )}
        {badge > 0 && !isPending ? <RailBadge count={badge} /> : null}
      </div>

      {/* Na barra de baixo do celular ficam no máximo quatro itens (o resto vai
          para "Mais"), cada um com ~78 px num celular de 320 px. "Comunicação"
          em 11 px mede ~74 px e passava por pouco do espaço sem o recuo do
          botão, quebrando em "Comunicaçã/o": fica numa linha só, e abaixo de
          ~350 px encolhe com a tela (10 px a 320 px) para não encostar em
          "Priorização". */}
      <div className="text-[12px] leading-[14px] font-medium text-center break-words w-full max-md:text-[min(11px,3.125vw)] max-md:leading-[13px] max-md:whitespace-nowrap">
        {label}
      </div>
    </>
  );
}

function HelpIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

/**
 * Auditoria e catálogo são links de verdade, e o Next avisa quando a navegação
 * daquele link está em voo. Sem isso a trilha fica parada por perto de um
 * segundo depois do clique, sem sinal nenhum de que algo aconteceu.
 */
function RailLinkContent({
  icon,
  label,
  isActive,
  badge,
}: {
  icon: string;
  label: string;
  isActive: boolean;
  badge?: number;
}) {
  const { pending } = useLinkStatus();

  return (
    <RailItemContent
      icon={icon}
      label={label}
      isPending={pending}
      isActive={isActive}
      badge={badge}
    />
  );
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
  onSectionIntent,
  isPanelOpen,
  onTogglePanel,
  showAuditLink = false,
  pendingSection = null,
  onReplayTour,
  className,
}: PlatformSideRailProps) {
  const t = useTranslations("PlatformSideRail");
  const tTour = useTranslations("PlatformTour");
  const pendingApprovals = usePendingApprovalsCount(showAuditLink);
  // Admin vê seis itens em vez de três: com o espaçamento folgado do layout
  // padrão eles não cabem num notebook comum e a lista vazava por cima do
  // rodapé. Aperta o espaço entre eles, e a lista rola se ainda faltar altura.
  const compact = showAuditLink;
  const itemHeightClass = compact ? "h-[72px]" : "h-[88px]";
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  // No celular a trilha vira a barra de baixo, e sete itens não cabem em 360
  // px ("Catálogo de índices" saía cortado na borda). Quem administra vê as
  // três seções e um "Mais" que abre o resto numa lista acima da barra.
  const hasOverflow = showAuditLink;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuId = useId();
  const [moreSection, setMoreSection] = useState(activeSection);
  if (moreSection !== activeSection) {
    setMoreSection(activeSection);
    setMoreOpen(false);
  }

  // Esc fecha e o foco volta ao "Mais"; o Tab não fica preso, porque a lista
  // não bloqueia a barra.
  const moreMenuRef = useRef<HTMLElement>(null);
  useDialogFocus(moreMenuRef, {
    open: moreOpen,
    onClose: () => setMoreOpen(false),
    trapFocus: false,
  });

  // Um destaque só, que desliza até a seção escolhida, em vez de um fundo que
  // some num item e aparece no outro. Mede o item atual e move o destaque por
  // estilo direto, sem estado, para não renderizar a trilha duas vezes. Mede
  // nos dois eixos porque no celular a trilha vira a barra de baixo, e mede de
  // novo quando a lista muda de tamanho (girar o celular troca o layout).
  useLayoutEffect(() => {
    const indicator = indicatorRef.current;
    const list = listRef.current;
    if (!indicator || !list) return;

    const place = () => {
      // No celular o item ativo pode estar dentro do "Mais", escondido: aí o
      // destaque vai para o próprio "Mais".
      const current = [
        ...list.querySelectorAll<HTMLElement>(
          '[aria-current="page"], [data-rail-more-current]',
        ),
      ].find((element) => element.offsetWidth > 0);

      if (!current) {
        indicator.style.opacity = "0";
        return;
      }

      indicator.style.translate = `${current.offsetLeft}px ${current.offsetTop}px`;
      indicator.style.width = `${current.offsetWidth}px`;
      indicator.style.height = `${current.offsetHeight}px`;
      indicator.style.opacity = "1";
      // Na primeira medida o destaque já nasce no lugar; só depois ele desliza.
      if (!indicator.dataset.ready) {
        void indicator.offsetHeight;
        indicator.dataset.ready = "true";
      }
    };

    place();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(place);
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeSection, compact, hasOverflow]);

  const items: PlatformRailItem[] = [
    { kind: "section", id: "monitoring", label: t("monitoring"), icon: "eye" },
    {
      kind: "section",
      id: "communication",
      label: t("communication"),
      icon: "chat-bubble",
    },
    { kind: "section", id: "analysis", label: t("analysis"), icon: "target" },
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
    // Sem este item, a tela de aprovação só era alcançável pelo link dentro do
    // e-mail de aviso — então uma falha de envio deixava os pedidos invisíveis,
    // acumulando sem ninguém saber que existiam.
    items.push({
      kind: "link",
      id: "approvals",
      href: APPROVALS_PATH,
      label: t("approvals"),
      icon: "user",
    });
  }

  const overflowItems = items.filter((item) => item.kind === "link");
  // No celular a lista divide a barra com o botão Tutorial. Crescendo na
  // proporção dos itens que mostra, cada botão fica com a mesma largura; com
  // `flex-1` nos dois, as três seções se espremiam em meia barra e
  // "Comunicação" quebrava em duas linhas.
  const phoneListItemCount =
    items.filter((item) => item.kind === "section").length +
    (hasOverflow ? 1 : 0);

  return (
    <div
      className={clsx(
        // `top-16.5` acompanha a altura real do cabeçalho; `max-h-full` impede
        // que a trilha ultrapasse a casca e invada o rodapé nas telas que rolam.
        // No celular não cabe uma coluna de 124px ao lado do painel: a trilha
        // vira uma barra presa embaixo da tela, como as abas de um app.
        `sticky top-16.5 relative max-h-full w-[124px] shrink-0 self-start ${PLATFORM_SHELL_HEIGHT_CLASS}`,
        "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:z-40 max-md:h-16 max-md:max-h-none max-md:w-full",
        className,
      )}
      data-platform-side-rail
    >
      <nav
        className={clsx(
          "flex h-full w-full flex-col border-r border-[#EFEFEF] bg-white px-[16px] pb-[18px]",
          compact ? "pt-[24px]" : "pt-[48px]",
          "max-md:flex-row max-md:border-r-0 max-md:border-t max-md:p-1 max-md:shadow-[0_-4px_16px_rgba(33,36,15,0.06)]",
        )}
      >
        <div
          ref={listRef}
          className={clsx(
            "relative w-[92px] min-h-0 flex-1 flex flex-col overflow-y-auto [scrollbar-width:thin]",
            compact ? "gap-2" : "gap-4",
            "max-md:w-auto max-md:min-w-0 max-md:flex-row max-md:gap-0 max-md:overflow-x-auto max-md:overflow-y-hidden",
          )}
          data-tour="platform-sections"
          style={{ flexGrow: phoneListItemCount }}
        >
          <span
            ref={indicatorRef}
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 w-full rounded-lg bg-[#E1E2B4] opacity-0 shadow-[inset_0_0_0_1px_rgba(152,159,67,0.25)] data-[ready]:transition-[translate,width,height,opacity] data-[ready]:duration-500 data-[ready]:ease-[cubic-bezier(0.34,1.4,0.64,1)]"
          />
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
                  "w-full shrink-0 flex flex-col items-center",
                  index !== 0 && "border-t border-[#ECECEC]",
                  "max-md:w-auto max-md:min-w-16 max-md:flex-1 max-md:border-t-0",
                  item.kind === "link" && "max-md:hidden",
                )}
              >
                {item.kind === "section" ? (
                  <button
                    type="button"
                    onClick={() => onSectionChange(item.id)}
                    onPointerEnter={() => onSectionIntent?.(item.id)}
                    onFocus={() => onSectionIntent?.(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    aria-busy={pendingSection === item.id || undefined}
                    className={clsx(
                      "group relative cursor-pointer w-full flex flex-col items-center justify-center gap-[4px] px-[4px] max-md:px-0.5 rounded-lg transition-colors duration-150",
                      itemHeightClass,
                      "max-md:h-full",
                      isActive
                        ? "text-[#5B612A]"
                        : "text-[#292829] hover:bg-[#F8F7F8]",
                    )}
                  >
                    <RailItemContent
                      icon={item.icon}
                      label={item.label}
                      isPending={pendingSection === item.id}
                      isActive={isActive}
                    />
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={clsx(
                      "group relative w-full flex flex-col items-center justify-center gap-[4px] px-[4px] max-md:px-0.5 rounded-lg transition-colors duration-150",
                      itemHeightClass,
                      "max-md:h-full",
                      isActive
                        ? "text-[#5B612A]"
                        : "text-[#292829] hover:bg-[#F8F7F8]",
                    )}
                  >
                    <RailLinkContent
                      icon={item.icon}
                      label={item.label}
                      isActive={isActive}
                      badge={
                        item.id === "approvals" ? pendingApprovals : undefined
                      }
                    />
                  </Link>
                )}
              </div>
            );
          })}

          {hasOverflow && (
            <div className="hidden max-md:flex max-md:min-w-16 max-md:flex-1 flex-col items-center">
              <button
                type="button"
                onClick={() => setMoreOpen((open) => !open)}
                aria-label={
                  pendingApprovals > 0
                    ? `${t("more")}. ${t("pendingApprovals", { count: pendingApprovals })}`
                    : undefined
                }
                aria-expanded={moreOpen}
                aria-controls={moreMenuId}
                data-tour="platform-more"
                data-rail-more-current={
                  overflowItems.some((item) => item.id === activeSection) ||
                  undefined
                }
                className={clsx(
                  "group relative flex h-full w-full cursor-pointer flex-col items-center justify-center gap-[4px] rounded-lg px-0.5 transition-colors duration-150",
                  moreOpen ||
                    overflowItems.some((item) => item.id === activeSection)
                    ? "text-[#5B612A]"
                    : "text-[#292829]",
                )}
              >
                <div className="relative flex items-center justify-center">
                  <MoreIcon />
                  {pendingApprovals > 0 ? (
                    <span
                      aria-hidden
                      className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#B3261E] px-1 text-[10px] font-semibold leading-none text-white"
                    >
                      {pendingApprovals > 99 ? "99+" : pendingApprovals}
                    </span>
                  ) : null}
                </div>
                <div className="w-full text-center text-[11px] font-medium leading-[13px]">
                  {t("more")}
                </div>
              </button>
            </div>
          )}
        </div>

        {onReplayTour && (
          <button
            type="button"
            onClick={onReplayTour}
            aria-label={tTour("replayLabel")}
            data-tour="platform-tour-replay"
            className={clsx(
              "group mt-3 flex w-[92px] shrink-0 cursor-pointer flex-col items-center justify-center gap-[4px] rounded-lg px-[8px] py-[10px] text-[#292829] transition-colors duration-150 hover:bg-[#F8F7F8] max-md:mt-0 max-md:w-auto max-md:min-w-16 max-md:flex-1 max-md:py-0",
              hasOverflow && "max-md:hidden",
            )}
          >
            <span className="flex motion-safe:group-hover:animate-[icon-wiggle_600ms_ease-in-out]">
              <HelpIcon />
            </span>
            <span className="text-[12px] leading-[14px] font-medium max-md:text-[11px] max-md:leading-[13px]">
              {tTour("replay")}
            </span>
          </button>
        )}
      </nav>

      {moreOpen &&
        createPortal(
          <div className="md:hidden">
            <div
              aria-hidden
              onClick={() => setMoreOpen(false)}
              className="fixed inset-x-0 top-0 bottom-16 z-50 bg-[#21240F]/40"
            />
            <nav
              ref={moreMenuRef}
              id={moreMenuId}
              aria-label={t("more")}
              className="fixed inset-x-2 bottom-[4.5rem] z-50 rounded-xl bg-white p-2 shadow-[0_12px_32px_rgba(33,36,15,0.24)] motion-safe:animate-[menu-in_180ms_ease-out]"
            >
              <ul className="flex flex-col">
                {overflowItems.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      aria-current={
                        item.id === activeSection ? "page" : undefined
                      }
                      className={clsx(
                        "flex min-h-12 items-center gap-3 rounded-lg px-3 text-[15px] font-medium",
                        item.id === activeSection
                          ? "bg-[#E1E2B4] text-[#5B612A]"
                          : "text-[#292829] active:bg-[#F5F6EE]",
                      )}
                    >
                      <Icon id={item.icon} size={22} />
                      <span className="flex-1">{item.label}</span>
                      {item.id === "approvals" && pendingApprovals > 0 ? (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#B3261E] px-1.5 text-[11px] font-semibold text-white">
                          {pendingApprovals > 99 ? "99+" : pendingApprovals}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
                {onReplayTour && (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        onReplayTour();
                      }}
                      className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-[15px] font-medium text-[#292829] active:bg-[#F5F6EE]"
                    >
                      <HelpIcon />
                      {tTour("replay")}
                    </button>
                  </li>
                )}
              </ul>
            </nav>
          </div>,
          document.body,
        )}

      {activeSection !== "analysis" &&
        activeSection !== "logs" &&
        activeSection !== "catalog" && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 transition-[right] duration-300 ease-in-out max-md:hidden ${isPanelOpen ? "-right-[464px]" : "-right-[39px]"}`}
          >
            <button
              type="button"
              aria-label={isPanelOpen ? t("collapsePanel") : t("expandPanel")}
              aria-expanded={isPanelOpen}
              onClick={onTogglePanel}
              className="group h-10 w-10 rounded-r-lg border border-neutral-200 bg-white shadow-sm flex items-center justify-center transition-[background-color,box-shadow] duration-200 hover:bg-[#F5F6EE] hover:shadow-md"
            >
              <span
                className={`cursor-pointer text-sm font-bold transition-[translate] duration-200 ${isPanelOpen ? "group-hover:-translate-x-0.5" : "group-hover:translate-x-0.5"}`}
              >
                <Chevron open={isPanelOpen} from="left" to="right" />
              </span>
            </button>
          </div>
        )}
    </div>
  );
}
