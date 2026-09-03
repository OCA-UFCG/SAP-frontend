"use client";

import { ClassColorField } from "@/components/IndexCatalog/ClassColorField";

/** Cor de cabeçalho sugerida quando o operador pede uma cor própria. */
const SUGGESTED_SECTION_COLOR = "#176B39";

/**
 * O texto do relatório em edição. Vive separado de `IndexCatalogDraftInput` de
 * propósito: mudar uma frase não descreve os dados e não pode invalidar a
 * prévia já validada no Earth Engine.
 */
export interface IndexCatalogReportDraft {
  sections: Array<{ title: string; text: string }>;
  sectionColor: string;
  methodology: string;
}

export const EMPTY_REPORT_DRAFT: IndexCatalogReportDraft = {
  sections: [],
  sectionColor: "",
  methodology: "",
};

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
  function updateSection(index: number, values: Partial<{ title: string; text: string }>) {
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
      <p className="text-sm text-stone-600">
        Estes textos aparecem no relatório do município, na parte deste índice.
        Deixe tudo em branco para continuar usando o texto do documento
        compartilhado no Google Docs.
      </p>
      <p className="mt-2 text-xs text-stone-500">
        Uma seção chamada “Situação atual” substitui a frase que o relatório
        monta sozinho. Você pode inserir dados do município escrevendo o nome do
        dado entre colchetes, como <code>[municipio]</code> ou{" "}
        <code>[ano]</code>.
      </p>

      <div className="mt-4 space-y-4">
        {report.sections.map((section, index) => (
          <div key={index} className="rounded-md border border-stone-200 p-3">
            <div className="flex items-end gap-3">
              <label className="flex-1 text-xs font-medium">
                Título da seção {index + 1}
                <input
                  className={inputClass}
                  maxLength={160}
                  placeholder="Situação atual"
                  value={section.title}
                  onChange={(event) =>
                    updateSection(index, { title: event.target.value })
                  }
                />
              </label>
              <button
                type="button"
                className="cursor-pointer rounded-md border border-[#CFD0CA] px-3 py-2 text-xs font-semibold hover:bg-[#F4F5D8]"
                onClick={() =>
                  onChange({
                    ...report,
                    sections: report.sections.filter(
                      (_, position) => position !== index,
                    ),
                  })
                }
              >
                Remover
              </button>
            </div>
            <label className="mt-3 block text-xs font-medium">
              Texto
              <textarea
                className={`${inputClass} min-h-24`}
                maxLength={4000}
                value={section.text}
                onChange={(event) =>
                  updateSection(index, { text: event.target.value })
                }
              />
            </label>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="mt-3 cursor-pointer rounded-md border border-[#CFD0CA] px-3 py-2 text-xs font-semibold hover:bg-[#F4F5D8] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={report.sections.length >= 12}
        onClick={() =>
          onChange({
            ...report,
            sections: [...report.sections, { title: "", text: "" }],
          })
        }
      >
        Adicionar seção
      </button>

      <label className="mt-6 block text-xs font-medium">
        Nota de metodologia
        <textarea
          className={`${inputClass} min-h-20`}
          maxLength={2000}
          placeholder="Como o índice é produzido, em uma ou duas frases. Aparece nas notas ao pé do relatório."
          value={report.methodology}
          onChange={(event) =>
            onChange({ ...report, methodology: event.target.value })
          }
        />
      </label>

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
          Salvar os textos não refaz a conferência dos assets: a prévia já
          validada continua valendo.
        </p>
      </div>
    </fieldset>
  );
}
