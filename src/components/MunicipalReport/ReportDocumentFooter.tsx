"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

export function ReportDocumentFooter({
  generatedAt,
  text,
}: {
  generatedAt: string;
  text?: string;
}) {
  const t = useTranslations("MunicipalReport");

  return (
    <footer className="report-document-footer flex items-center gap-6 border-t border-[#D3DCD5] pt-6">
      <span className="flex shrink-0 items-center gap-2">
        <Image
          alt=""
          aria-hidden
          src="/sedes-mark-dark.svg"
          width={17}
          height={24}
          className="h-6 w-auto"
        />
        <Image
          alt="SEDES"
          src="/sedes-wordmark-dark.svg"
          width={45}
          height={24}
          className="h-6 w-auto"
        />
      </span>
      <p className="text-sm leading-6 text-[#58655C]">
        {text ?? `${t("generatedAt")}: ${generatedAt} | ${t("document.footerCredits")}`}
      </p>
    </footer>
  );
}
