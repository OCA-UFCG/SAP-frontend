"use client";
import { useEffect, useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/translations/routing";
import { cn } from "@/lib/utils";
import { ISection } from "@/utils/interfaces";
import { Hamburguer } from "../HamburguerButton/HamburguerButton";
import { LANGUAGES } from "../LanguageSwitcher/LanguageSwitcher";
import { shouldPrefetchFullRoute } from "../NavItems/NavItems";

/** A partir daqui o menu do topo aparece inteiro na barra (`xl:` no Header). */
const DESKTOP_MENU = "(min-width: 1280px)";

/**
 * O menu do topo no celular e no tablet. Desce logo abaixo da barra e só ocupa
 * a altura dos itens; o resto da página escurece e fecha o menu ao toque.
 * Antes ele era uma coluna da altura da tela com os itens soltos no meio.
 *
 * As seções da home ficam recolhidas sob "Início", e o idioma, que no celular
 * não cabe ao lado da logo, aparece no pé do menu.
 */
export const MenuModal = ({ content }: { content: ISection[] }) => {
  const t = useTranslations("Navigation");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const menuId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Mudar de página fecha o menu, também pelo voltar do navegador.
  const [openedAt, setOpenedAt] = useState(pathname);
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setIsOpen(false);
  }

  const close = () => setIsOpen(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    // Girar o tablet até o menu da barra aparecer esconde este; sem fechar,
    // a página ficaria sem rolar.
    const desktop = window.matchMedia(DESKTOP_MENU);
    const onDesktop = () => desktop.matches && setIsOpen(false);
    // Sem isso a página rola por trás do menu quando o dedo arrasta nele.
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onDesktop);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onDesktop);
    };
  }, [isOpen]);

  const rowClassName = (active: boolean) =>
    cn(
      "relative flex min-h-12 flex-1 items-center px-6 py-3 text-base font-medium transition-colors active:bg-[#E4E5E2]",
      active ? "text-[#5B612A]" : "text-[#292829]",
    );

  return (
    <div className="flex">
      <Hamburguer
        open={isOpen}
        label={isOpen ? t("closeMenu") : t("openMenu")}
        controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
      />

      <div
        aria-hidden
        onClick={close}
        className={cn(
          "fixed inset-x-0 top-16.5 bottom-0 z-30 bg-[#21240F]/40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* O `pt-5` deixa a ponta da aba da logo, que desce 16 px abaixo da
          barra, por cima de um respiro e não do primeiro item. */}
      <div
        id={menuId}
        inert={!isOpen}
        className={cn(
          "fixed inset-x-0 top-16.5 z-40 max-h-[calc(100dvh-4.125rem)] overflow-y-auto overscroll-contain bg-[#F6F3F0] pt-5 shadow-[0_16px_32px_rgba(33,36,15,0.18)] sm:left-auto sm:right-4 sm:w-90 sm:rounded-b-xl",
          "transition-[opacity,translate] duration-300 ease-out",
          isOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-3 opacity-0",
        )}
      >
        <ul className="divide-y divide-[#E4E5E2] border-y border-[#E4E5E2]">
          {content.map((item) => {
            const href = item.path || "/";
            const active = pathname === href;
            const children =
              item.childrenCollection?.items.filter(
                (child) => child.appears !== false,
              ) ?? [];
            const isExpanded = expanded === item.id;
            const childrenId = `${menuId}-${item.id}`;

            return (
              <li key={item.id}>
                <div className="flex items-stretch">
                  <Link
                    href={href}
                    onClick={close}
                    prefetch={shouldPrefetchFullRoute(item.path)}
                    aria-current={active ? "page" : undefined}
                    className={rowClassName(active)}
                  >
                    {active && (
                      <span
                        aria-hidden
                        className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[#777E32]"
                      />
                    )}
                    {item.name}
                  </Link>
                  {children.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : item.id)}
                      aria-expanded={isExpanded}
                      aria-controls={childrenId}
                      aria-label={t(
                        isExpanded ? "hideSections" : "showSections",
                        { name: item.name ?? "" },
                      )}
                      className="flex w-14 shrink-0 cursor-pointer items-center justify-center border-l border-[#E4E5E2] text-[#777E32] transition-colors active:bg-[#E4E5E2]"
                    >
                      <svg
                        width="12"
                        height="8"
                        viewBox="0 0 10 6"
                        fill="none"
                        aria-hidden
                        className={cn(
                          "transition-transform duration-200",
                          isExpanded && "rotate-180",
                        )}
                      >
                        <path
                          d="M1 1L5 5L9 1"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  )}
                </div>

                {children.length > 0 && (
                  <ul id={childrenId} hidden={!isExpanded} className="pb-2">
                    {children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={child.path || "#"}
                          onClick={close}
                          className="flex min-h-11 items-center pr-6 pl-10 text-[15px] text-[#3F4324] transition-colors active:bg-[#E4E5E2]"
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        {/* Do `sm` em diante o idioma cabe na barra (UserAuth). */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 sm:hidden">
          <span className="text-sm font-medium text-[#5F5E5F]">
            {t("language")}
          </span>
          <div
            role="group"
            aria-label={t("language")}
            className="flex rounded-lg border border-[#DCDBDC] bg-white p-1"
          >
            {LANGUAGES.map((language) => {
              const current = locale === language.code;
              return (
                <button
                  key={language.code}
                  type="button"
                  lang={language.code}
                  aria-pressed={current}
                  aria-label={language.name}
                  onClick={() => {
                    close();
                    if (!current) {
                      router.replace(pathname, { locale: language.code });
                    }
                  }}
                  className={cn(
                    "h-9 min-w-12 cursor-pointer rounded-md px-3 text-sm font-semibold transition-colors",
                    current
                      ? "bg-[#5B612A] text-white"
                      : "text-[#292829] active:bg-[#E4E5E2]",
                  )}
                >
                  {language.acronym}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
