"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Icon } from "../Icon/Icon";
import { LanguageSwitcher } from "../LanguageSwitcher/LanguageSwitcher";
import { navigateWithFullReload } from "@/utils/fullPageNavigation";
import { Link } from "@/translations/routing";
import { useDialogFocus } from "@/hooks/useDialogFocus";

export const UserAuth = () => {
  const t = useTranslations("UserAuth");
  const { user, loading, signOut } = useAuth();
  const [openPathname, setOpenPathname] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const isOpen = openPathname === pathname;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenPathname(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Esc fecha e devolve o foco ao botão do usuário. O Tab não fica preso: o
  // menu não bloqueia a página, então sair dele com o Tab é o esperado.
  useDialogFocus(popoverRef, {
    open: isOpen,
    onClose: () => setOpenPathname(null),
    trapFocus: false,
  });

  if (loading) return null;

  const handleLogout = async () => {
    setOpenPathname(null);

    if (!user) return;

    await signOut();
    // Recarrega em vez de `router.push` para descartar a plataforma guardada
    // no cache do router; ver `navigateWithFullReload`.
    navigateWithFullReload("/login");
  };

  const handleLogin = () => {
    setOpenPathname(null);
    router.push("/login");
  };

  const sessionLabel = user ? t("connectedUser") : t("sessionStatus");
  const sessionValue = user?.email || t("disconnected");

  return (
    <div className="flex items-center gap-4 max-sm:gap-1">
      {/* No celular o idioma fica no menu (MenuModal): ao lado da logo ele
          não cabia e ficava escondido atrás dela. */}
      <div className="max-sm:hidden">
        <LanguageSwitcher />
      </div>

      {!user ? (
        <button
          type="button"
          onClick={handleLogin}
          className="flex h-10 cursor-pointer items-center rounded-md px-4 max-sm:px-3 py-2 font-medium text-neutral-800 transition-[background-color,color,box-shadow,scale] duration-300 hover:bg-[#646B2D] hover:text-[#F8F7F8] hover:shadow-[0_6px_16px_rgba(152,159,67,0.35)] focus:outline-none focus:ring-2 focus:ring-[#5B612A] active:scale-[0.97]"
        >
          {t("login")}
        </button>
      ) : (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() =>
              setOpenPathname((currentPathname) =>
                currentPathname === pathname ? null : pathname,
              )
            }
            className="flex items-center justify-center cursor-pointer w-10 h-10 rounded-full hover:bg-stone-200 hover:ring-2 hover:ring-[#B4BA61] focus:outline-none focus:ring-2 focus:ring-[#5B612A] transition-[background-color,box-shadow,scale] duration-300 motion-safe:hover:scale-110"
            aria-label={t("menuLabel")}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
          >
            <Icon id="user" size={24} className="stroke-[#21240F]" />
          </button>

          {isOpen && (
            <div
              ref={popoverRef}
              tabIndex={-1}
              className="absolute right-0 mt-2 w-56 origin-top-right rounded-md border border-stone-200 bg-white py-1 shadow-[0_16px_32px_rgba(33,36,15,0.14)] z-50 motion-safe:animate-[menu-in_180ms_ease-out] focus:outline-none"
              role="dialog"
              aria-label={t("statusLabel")}
            >
              <div className="px-4 py-3 border-b border-stone-100">
                <p className="text-sm font-medium text-stone-900">
                  {sessionLabel}
                </p>
                <p
                  className="text-sm text-stone-500 truncate"
                  title={sessionValue}
                >
                  {sessionValue}
                </p>
              </div>

              {/* Excluir a conta fica dentro de "Minha conta", e não solto no
                  menu, onde ficava a um clique por engano. */}
              <Link
                href="/minha-conta"
                onClick={() => setOpenPathname(null)}
                className="block w-full px-4 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100"
              >
                {t("myAccount")}
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full text-left cursor-pointer px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-stone-100"
              >
                {t("logout")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
