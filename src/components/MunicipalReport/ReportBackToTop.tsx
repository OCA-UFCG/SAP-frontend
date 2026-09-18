"use client";

import type { MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { easeScrollTo, findScrollableAncestor } from "@/utils/reportScroll";

export function ReportBackToTop() {
  const t = useTranslations("MunicipalReport");

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const scrollable = findScrollableAncestor(event.currentTarget);
    if (!scrollable) return;

    event.preventDefault();
    easeScrollTo(scrollable, 0);
  }

  return (
    <div className="report-back-to-top sticky top-0 z-10 bg-[#DDE3AE] print:hidden">
      <a
        href="#report-top"
        onClick={handleClick}
        className="flex items-center gap-2 px-10 py-3 text-sm font-medium text-[#292829]"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path
            d="M5 12.5L10 7.5L15 12.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {t("document.backToTop")}
      </a>
    </div>
  );
}
