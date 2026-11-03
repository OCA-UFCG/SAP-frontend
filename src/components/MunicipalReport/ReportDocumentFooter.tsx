"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

/**
 * O rodapé do documento. O texto é fixo: o campo "Rodapé" do Google Docs
 * engolia as linhas seguintes do modelo ("Campos dinâmicos disponíveis neste
 * bloco...") e elas saíam impressas no fim do relatório.
 */
export function ReportDocumentFooter({ generatedAt }: { generatedAt: string }) {
  const t = useTranslations("MunicipalReport");

  return (
    <footer className="report-document-footer flex items-center gap-6 border-t border-[#D3DCD5] pt-6">
      <span className="flex shrink-0 items-center gap-2">
        <Image
          alt="SEDES"
          src="/sedes-logo-dark.svg"
          width={71}
          height={24}
          className="h-6 w-auto"
        />
      </span>
      <p className="text-sm leading-6 text-[#58655C]">
        {t("document.footer", { generatedAt })}
      </p>
    </footer>
  );
}
