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
  describeSeverityChoice,
  toSeverityOrder,
  type IndexCatalogReportDraft,
  type ReportSeverityChoice,
} from "@/utils/indexCatalogReportDraft";

/** Cor de cabeçalho sugerida quando o operador pede uma cor própria. */
const SUGGESTED_SECTION_COLOR = "#176B39";

const MAX_SECTIONS = 12;
const GENERIC_SECTION_HINT =
  "Texto desta seção do relatório. Use colchetes para inserir dados do município.";
const DEFAULT_INTRO =
  "Este é o texto que ficará na parte deste índice no relatório municipal. Ele já vem preenchido com um texto padrão que funciona para qualquer índice — ajuste as frases ao seu índice antes de publicar.";
const DEFAULT_SAVE_HINT =
  "Este botão grava só os textos, sem refazer a conferência dos assets: a prévia já validada continua valendo. “Salvar rascunho” e “Validar assets e gerar prévia” também gravam os textos.";

function getSectionHint(index: number) {
  return CATALOG_REPORT_SECTION_HINTS[index] ?? GENERIC_SECTION_HINT;
}

const SEVERITY_CHOICES: ReadonlyArray<{
  value: Exclude<ReportSeverityChoice, "stale">;
  label: string;
}> = [
  { value: "none", label: "Não têm ordem de gravidade" },
  { value: "best-first", label: "Da melhor para a pior, na ordem da legenda" },
  { value: "worst-first", label: "Da pior para a melhor, na ordem da legenda" },
];

/**
 * A única informação do relatório que não dá para deduzir do asset: qual classe
 * é pior que qual.
 *
 * A pergunta existe em vez de um palpite pela ordem da legenda porque um índice
 * de cobertura da terra não tem ordem de gravidade nenhuma, e inventar uma daria
 * uma frase errada com cara de certa. O padrão é "não têm ordem": quem não
 * responde não ganha as variáveis de tendência, e isso é o resultado correto.
 */
function ReportSeverityFields({
  report,
  classes,
  inputClass,
  onChange,
}: {
  report: IndexCatalogReportDraft;
  classes: ReadonlyArray<{ id: string; label: string }>;
  inputClass: string;
  onChange: (report: IndexCatalogReportDraft) => void;
}) {
  const classIds = classes.map((entry) => entry.id);
  const choice = describeSeverityChoice(report.severityOrder, classIds);
  const ordered = report.severityOrder
    .map((id) => classes.find((entry) => entry.id === id)?.label ?? id)
    .join(" → ");

  return (
    <div className="mt-6 rounded-md border border-stone-200 bg-stone-50/60 p-3">
      <label className="block text-xs font-medium">
        As classes deste índice vão da melhor para a pior?
        <select
          className={inputClass}
          value={choice === "stale" ? "none" : choice}
          onChange={(event) =>
            onChange({
              ...report,
              severityOrder: toSeverityOrder(
                event.target.value as ReportSeverityChoice,
                classIds,
              ),
              neutralClassId:
                event.target.value === "none" ? "" : report.neutralClassId,
            })
          }
        >
          {SEVERITY_CHOICES.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-1 text-xs text-stone-500">
        Só com essa resposta o relatório consegue dizer que a situação está
        agravando, amenizando ou se mantendo, e qual foi a pior condição já
        registrada. Um índice sem ordem — cobertura da terra, por exemplo —
        simplesmente fica sem essas frases.
      </p>
      {choice === "stale" && (
        <p className="mt-2 text-xs text-red-700">
          As classes mudaram depois que a ordem foi declarada, então ela foi
          descartada. Responda de novo para voltar a ter as frases de tendência.
        </p>
      )}
      {report.severityOrder.length >= 2 && (
        <>
          <p className="mt-2 text-xs text-stone-600">
            Da melhor para a pior: <strong>{ordered}</strong>
          </p>
          <label className="mt-3 block text-xs font-medium">
            Qual classe representa a condição normal? (opcional)
            <select
              className={inputClass}
              value={report.neutralClassId}
              onChange={(event) =>
                onChange({ ...report, neutralClassId: event.target.value })
              }
            >
              <option value="">Nenhuma</option>
              {classes.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label || entry.id}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-1 text-xs text-stone-500">
            É o equivalente ao “sem seca”: com ela o relatório pode contar em
            quantos períodos o município ficou fora da condição normal.
          </p>
        </>
      )}
    </div>
  );
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
  /** Substitui a explicação de abertura; o índice legado tem outra história. */
  intro?: string;
  /** Explicação abaixo do botão de salvar. */
  saveHint?: string;
  /** Botões extra ao lado de "Adicionar seção", como importar do Google Docs. */
  extraActions?: React.ReactNode;
  /**
   * As classes do índice em edição. Ausente no índice legado adotado, que não
   * as edita aqui: sem elas a pergunta de gravidade não aparece.
   */
  classes?: ReadonlyArray<{ id: string; label: string }>;
}

export function IndexCatalogReportFields({
  report,
  inputClass,
  buttonClass,
  disabled,
  onChange,
  onSave,
  intro = DEFAULT_INTRO,
  saveHint = DEFAULT_SAVE_HINT,
  extraActions,
  classes,
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
        <p className="max-w-2xl text-sm text-stone-600">{intro}</p>
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
        <code>[municipio]</code>, <code>[indice]</code>, <code>[classe]</code>,{" "}
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
        {extraActions}
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

      {classes && classes.length > 1 && (
        <ReportSeverityFields
          report={report}
          classes={classes}
          inputClass={inputClass}
          onChange={onChange}
        />
      )}

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
        <p className="mt-2 text-xs text-stone-500">{saveHint}</p>
      </div>

      {guideOpen && (
        <IndexCatalogReportGuideModal onClose={() => setGuideOpen(false)} />
      )}
    </fieldset>
  );
}
