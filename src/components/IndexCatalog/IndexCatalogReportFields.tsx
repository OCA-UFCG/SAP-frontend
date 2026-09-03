"use client";

import { useState } from "react";
import { ClassColorField } from "@/components/IndexCatalog/ClassColorField";
import { IndexCatalogReportGuideModal } from "@/components/IndexCatalog/IndexCatalogReportGuideModal";
import {
  CATALOG_REPORT_SECTION_HINTS,
  DEFAULT_CATALOG_REPORT_METHODOLOGY,
  DEFAULT_CATALOG_REPORT_SECTIONS,
} from "@/config/indexCatalogReportText";
import {
  createDefaultReportDraft,
  type IndexCatalogReportDraft,
} from "@/utils/indexCatalogReportDraft";

/** Cor de cabeçalho sugerida quando o operador pede uma cor própria. */
const SUGGESTED_SECTION_COLOR = "#176B39";

const MAX_SECTIONS = 12;
const GENERIC_SECTION_HINT =
  "Texto desta seção do relatório. Use colchetes para inserir dados do município.";

function getSectionHint(index: number) {
  return CATALOG_REPORT_SECTION_HINTS[index] ?? GENERIC_SECTION_HINT;
}

interface ReportSectionCardProps {
  index: number;
  section: { title: string; text: string };
  inputClass: string;
  onChange: (values: Partial<{ title: string; text: string }>) => void;
  onRemove: () => void;
}

function ReportSectionCard({
  index,
  section,
  inputClass,
  onChange,
  onRemove,
}: ReportSectionCardProps) {
  const suggested = DEFAULT_CATALOG_REPORT_SECTIONS[index];

  return (
    <div className="rounded-md border border-stone-200 bg-stone-50/60 p-3">
      <div className="flex items-end gap-3">
        <label className="flex-1 text-xs font-medium">
          Título da seção {index + 1}
          <input
            className={inputClass}
            maxLength={160}
            placeholder={suggested?.title ?? "Título que aparece no relatório"}
            value={section.title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </label>
        <button
          type="button"
          className="cursor-pointer rounded-md border border-[#CFD0CA] px-3 py-2 text-xs font-semibold hover:bg-[#F4F5D8]"
          onClick={onRemove}
        >
          Remover
        </button>
      </div>
      <label className="mt-3 block text-xs font-medium">
        Texto
        <textarea
          className={`${inputClass} min-h-24`}
          maxLength={4000}
          placeholder={suggested?.text ?? GENERIC_SECTION_HINT}
          value={section.text}
          onChange={(event) => onChange({ text: event.target.value })}
        />
      </label>
      <p className="mt-1 text-xs text-stone-500">{getSectionHint(index)}</p>
    </div>
  );
}

interface IndexCatalogReportFieldsProps {
  report: IndexCatalogReportDraft;
  inputClass: string;
  buttonClass: string;
  disabled: boolean;
  onChange: (report: IndexCatalogReportDraft) => void;
  onSave: () => void;
}

export function IndexCatalogReportFields({
  report,
  inputClass,
  buttonClass,
  disabled,
  onChange,
  onSave,
}: IndexCatalogReportFieldsProps) {
  const [guideOpen, setGuideOpen] = useState(false);

  function updateSection(
    index: number,
    values: Partial<{ title: string; text: string }>,
  ) {
    onChange({
      ...report,
      sections: report.sections.map((section, position) =>
        position === index ? { ...section, ...values } : section,
      ),
    });
  }

  return (
    <fieldset className="mt-7 rounded-lg border border-stone-200 p-4">
      <legend className="px-2 font-bold">Relatório Automático</legend>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-stone-600">
          Este é o texto que ficará na parte deste índice no relatório
          municipal. Ele já vem preenchido com um texto padrão que funciona para
          qualquer índice — ajuste as frases ao seu índice antes de publicar.
        </p>
        <button
          type="button"
          className="cursor-pointer rounded-md border border-[#CFD0CA] px-3 py-2 text-xs font-semibold whitespace-nowrap hover:bg-[#F4F5D8]"
          onClick={() => setGuideOpen(true)}
        >
          Guia e exemplos
        </button>
      </div>
      <p className="mt-2 text-xs text-stone-500">
        O que estiver entre colchetes é trocado pelo dado do município:{" "}
        <code>[municipio]</code>, <code>[classe]</code>,{" "}
        <code>[percentual]</code> e <code>[periodo_extenso]</code>. Um campo
        deixado em branco simplesmente não aparece no relatório.
      </p>

      <div className="mt-4 space-y-4">
        {report.sections.map((section, index) => (
          <ReportSectionCard
            key={index}
            index={index}
            section={section}
            inputClass={inputClass}
            onChange={(values) => updateSection(index, values)}
            onRemove={() =>
              onChange({
                ...report,
                sections: report.sections.filter(
                  (_, position) => position !== index,
                ),
              })
            }
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="cursor-pointer rounded-md border border-[#CFD0CA] px-3 py-2 text-xs font-semibold hover:bg-[#F4F5D8] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={report.sections.length >= MAX_SECTIONS}
          onClick={() =>
            onChange({
              ...report,
              sections: [...report.sections, { title: "", text: "" }],
            })
          }
        >
          Adicionar seção
        </button>
        <button
          type="button"
          className="cursor-pointer rounded-md border border-[#CFD0CA] px-3 py-2 text-xs font-semibold hover:bg-[#F4F5D8]"
          onClick={() =>
            onChange({
              ...createDefaultReportDraft(),
              sectionColor: report.sectionColor,
            })
          }
        >
          Restaurar o texto padrão
        </button>
      </div>

      <label className="mt-6 block text-xs font-medium">
        Nota de metodologia
        <textarea
          className={`${inputClass} min-h-20`}
          maxLength={2000}
          placeholder={DEFAULT_CATALOG_REPORT_METHODOLOGY}
          value={report.methodology}
          onChange={(event) =>
            onChange({ ...report, methodology: event.target.value })
          }
        />
      </label>
      <p className="mt-1 text-xs text-stone-500">
        Aparece nas notas ao pé do relatório. Vale citar a fonte dos dados, o
        período coberto e a regra que separa as classes.
      </p>

      <label className="mt-5 flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={Boolean(report.sectionColor)}
          onChange={(event) =>
            onChange({
              ...report,
              sectionColor: event.target.checked ? SUGGESTED_SECTION_COLOR : "",
            })
          }
        />
        Usar uma cor própria no cabeçalho desta seção do relatório
      </label>
      {report.sectionColor && (
        <div className="mt-3 max-w-xs">
          <ClassColorField
            color={report.sectionColor}
            inputClass={inputClass}
            label="seção do relatório"
            onChange={(sectionColor) => onChange({ ...report, sectionColor })}
          />
        </div>
      )}

      <div className="mt-6">
        <button
          type="button"
          className={`${buttonClass} border border-stone-300`}
          disabled={disabled}
          onClick={onSave}
        >
          Salvar textos do relatório
        </button>
        <p className="mt-2 text-xs text-stone-500">
          Este botão grava só os textos, sem refazer a conferência dos assets: a
          prévia já validada continua valendo. “Salvar rascunho” e “Validar
          assets e gerar prévia” também gravam os textos.
        </p>
      </div>

      {guideOpen && (
        <IndexCatalogReportGuideModal onClose={() => setGuideOpen(false)} />
      )}
    </fieldset>
  );
}
