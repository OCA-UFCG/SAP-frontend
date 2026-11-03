"use client";

/* eslint-disable @next/next/no-img-element -- ver o comentário de ReportPresentation. */

import { useTranslations } from "next-intl";
import type { MunicipalReportData } from "@/contracts/municipalReport";

const PARAGRAPHS = ["p1", "p2", "p3", "p4"] as const;

/**
 * A apresentação do relatório, numa página só dela, entre a capa e o sumário.
 * Só existe no PDF: na tela o relatório continua abrindo pelo cabeçalho, que
 * por sua vez some da impressão (`print:hidden` em `ReportHero`).
 *
 * O logo é `<img>` comum, como na capa: o `next/image` não carrega imagem
 * escondida, e o PDF sairia sem ele.
 */
export function ReportPresentation({
  territory,
}: {
  territory: MunicipalReportData["territory"];
}) {
  const t = useTranslations("MunicipalReport");
  const values = {
    territory: territory.label,
    scale: t(`document.presentationScales.${territory.level}`),
  };

  return (
    <section className="report-presentation font-open-sans hidden flex-col gap-6 print:flex">
      <img
        alt="SEDES"
        src="/sedes-logo-dark.svg"
        className="h-6 w-auto self-start"
      />
      <h2 className="text-[1.75rem] font-bold leading-[1.25] text-[#292829]">
        {t("document.presentationTitle")}
      </h2>
      <div className="flex flex-col gap-4">
        {PARAGRAPHS.map((key) => (
          <p
            key={key}
            className="text-[0.9375rem] leading-7 text-[#2C3A31]"
          >
            {t(`document.presentationParagraphs.${key}`, values)}
          </p>
        ))}
      </div>
    </section>
  );
}
