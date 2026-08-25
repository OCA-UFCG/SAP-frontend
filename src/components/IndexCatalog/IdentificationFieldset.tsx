"use client";

import {
  CATALOG_FIELDSET_CLASS,
  CATALOG_INPUT_CLASS,
} from "@/components/IndexCatalog/catalogFormStyles";
import { INDEX_CATEGORIES, type IndexCategory } from "@/types/indexCatalog";

interface IdentificationFieldsetProps {
  name: string;
  onNameChange: (name: string) => void;
  category: IndexCategory;
  onCategoryChange: (category: IndexCategory) => void;
  description: string;
  onDescriptionChange: (description: string) => void;
  /** Presente ao editar: o ID do panelLayer, que o formulário não pede. */
  technicalId?: string;
  /** Depois da primeira publicação o ID congela e deixa de seguir o nome. */
  technicalIdFrozen?: boolean;
}

export function IdentificationFieldset({
  name,
  onNameChange,
  category,
  onCategoryChange,
  description,
  onDescriptionChange,
  technicalId,
  technicalIdFrozen,
}: IdentificationFieldsetProps) {
  return (
    <fieldset className={CATALOG_FIELDSET_CLASS}>
      <legend className="px-2 font-bold">1. Identificação do índice</legend>
      <div className="mt-2 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">
          Nome
          <input
            className={CATALOG_INPUT_CLASS}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
          />
          {technicalId && (
            <span className="mt-1 block text-xs font-normal text-stone-600">
              ID técnico: <code>{technicalId}</code> —{" "}
              {technicalIdFrozen
                ? "congelado: o índice já foi publicado e telemetria, relatórios e caches usam esse ID como chave."
                : "gerado a partir do nome; acompanha o nome até a primeira publicação."}
            </span>
          )}
        </label>
        <label className="text-sm font-medium">
          Categoria
          <select
            className={CATALOG_INPUT_CLASS}
            value={category}
            onChange={(event) =>
              onCategoryChange(event.target.value as IndexCategory)
            }
          >
            {INDEX_CATEGORIES.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-stone-500">
            Define em qual grupo o índice aparece no Monitoramento.
          </span>
        </label>
        <label className="text-sm font-medium md:col-span-2">
          Descrição
          <textarea
            className={CATALOG_INPUT_CLASS}
            rows={3}
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
          />
        </label>
      </div>
    </fieldset>
  );
}
