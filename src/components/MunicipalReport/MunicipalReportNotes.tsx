"use client";

import { useTranslations } from "next-intl";
import { getMunicipalReportPresentation } from "@/config/municipalReport";
import type {
  MunicipalReportAnalysis,
  MunicipalReportDocsContent,
} from "@/contracts/municipalReport";
import { getReportDocsText } from "@/utils/municipalReportNarrative";
import { ReportSectionHeading } from "@/components/MunicipalReport/ReportSectionHeading";
import {
  translateAnalysisMethodology,
  translateAnalysisTitle,
} from "@/utils/municipalReportTranslations";

/**
 * O bloco de notas metodológicas que fecha o Relatório Automático: uma linha
 * por índice, a referência legal e o aviso de geração automática.
 *
 * A prévia do catálogo monta o mesmo bloco para um índice só, e é por isso que
 * ele mora fora do documento: enquanto a prévia tinha a sua própria versão, ela
 * mostrava só a nota do índice, sem título, sem referência legal e sem aviso.
 *
 * @example
 * <MunicipalReportNotes analyses={[analysis]} docsContent={docsContent} locale="pt" />
 */
export function MunicipalReportNotes({
  analyses,
  docsContent,
  locale,
}: {
  analyses: readonly MunicipalReportAnalysis[];
  docsContent: MunicipalReportDocsContent | null;
  locale: string;
}) {
  const t = useTranslations("MunicipalReport");
  const tModules = useTranslations("ModulesContext");
  const tHas = (key: string) => t.has(key);
  const tModulesHas = (key: string) => tModules.has(key);
  const reportText = (section: string, fallback: string) =>
    getReportDocsText(docsContent, section, locale) ?? fallback;

  return (
    <section className="report-notes border-t border-[#D3DCD5] pt-8">
      <ReportSectionHeading level={2} accent="#8B9440">
        {reportText("Título das notas", t("document.notesTitle"))}
      </ReportSectionHeading>
      <div className="mt-5 space-y-2 text-sm leading-6 text-[#2C3A31]">
        {analyses.map((analysis) => {
          const presentation = getMunicipalReportPresentation(analysis.id);
          const title = translateAnalysisTitle(
            analysis,
            t,
            tHas,
            tModules,
            tModulesHas,
          );
          const methodology = translateAnalysisMethodology(
            analysis,
            docsContent,
            analysis.presentation?.methodology ?? presentation.methodology,
            t,
            tHas,
            tModules,
            tModulesHas,
            locale,
          );
          return (
            <p key={analysis.id} className="whitespace-pre-line">
              <strong>{title}:</strong> {methodology}
            </p>
          );
        })}
        <p className="whitespace-pre-line">
          <strong>{t("document.legalReferenceLabel")}:</strong>{" "}
          {reportText("Referência legal", t("document.legalReferenceValue"))}
        </p>
      </div>
      <p className="mt-8 text-sm leading-6 text-[#58655C]">
        {reportText("Aviso automático", t("document.automatedNotice"))}
      </p>
    </section>
  );
}
