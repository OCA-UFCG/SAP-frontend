"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Icon } from "../Icon/Icon";
import { LanguageSwitcher } from "../LanguageSwitcher/LanguageSwitcher";

export const UserAuth = () => {
  const t = useTranslations("UserAuth");
  const { user, loading, signOut } = useAuth();
  const [openPathname, setOpenPathname] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
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

  if (loading) return null;

  const handleLogout = async () => {
    setOpenPathname(null);

    if (!user) return;

    await signOut();
    router.push("/login");
  };

  const handleLogin = () => {
    setOpenPathname(null);
    router.push("/login");
  };

  const sessionLabel = user ? t("connectedUser") : t("sessionStatus");
  const sessionValue = user?.email || t("disconnected");

  return (
    <div className="flex items-center gap-4">
      <LanguageSwitcher />

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() =>
            setOpenPathname((currentPathname) =>
              currentPathname === pathname ? null : pathname,
            )
          }
          className="flex items-center justify-center cursor-pointer w-10 h-10 rounded-full hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-[#777E32] transition-colors"
          aria-label={t("menuLabel")}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        >
          <Icon id="user" size={24} className="stroke-[#21240F]" />
        </button>

        {isOpen && (
          <div
            className="absolute right-0 mt-2 w-56 rounded-md border border-stone-200 bg-white py-1 shadow-lg z-50"
            role="dialog"
            aria-label={t("statusLabel")}
          >
            <div
              className={`px-4 py-3 ${user ? "border-b border-stone-100" : ""}`}
            >
              <p className="text-sm font-medium text-stone-900">{sessionLabel}</p>
              <p className="text-sm text-stone-500 truncate" title={sessionValue}>
                {sessionValue}
              </p>
            </div>

            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="w-full text-left cursor-pointer px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-stone-100"
              >
                {t("logout")}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLogin}
                className="w-full text-left cursor-pointer px-4 py-2 text-sm font-medium text-[#777E32] transition-colors hover:bg-stone-100"
              >
                {t("login")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
