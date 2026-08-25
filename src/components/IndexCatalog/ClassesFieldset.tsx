"use client";

import {
  CATALOG_BUTTON_CLASS,
  CATALOG_FIELDSET_CLASS,
  CATALOG_INPUT_CLASS,
} from "@/components/IndexCatalog/catalogFormStyles";
import type { ClassMapping } from "@/types/indexCatalog";

interface ClassesFieldsetProps {
  classes: ClassMapping[];
  onClassChange: (index: number, values: Partial<ClassMapping>) => void;
  onValidate: () => void;
  disabled: boolean;
}

/**
 * Rótulos e cores das classes. Os índices vêm de `perc_classe_XX` no asset, por
 * isso este passo só tem conteúdo depois da validação — e o botão de validar
 * fica aqui, no lugar onde a espera aparece, além da barra de ações.
 */
export function ClassesFieldset({
  classes,
  onClassChange,
  onValidate,
  disabled,
}: ClassesFieldsetProps) {
  return (
    <fieldset className={CATALOG_FIELDSET_CLASS}>
      <legend className="px-2 font-bold">4. Aparência das classes</legend>
      {classes.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-stone-500">
            Os índices das classes são descobertos no asset estatístico. Valide
            os assets para preencher esta lista e então escolher os nomes e as
            cores.
          </p>
          <button
            type="button"
            className={`${CATALOG_BUTTON_CLASS} bg-[#E1E2B4]`}
            disabled={disabled}
            onClick={onValidate}
          >
            Validar agora para descobrir as classes
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map((entry, index) => (
            <div
              key={entry.classIndex}
              className="grid items-end gap-3 md:grid-cols-[110px_1fr_110px]"
            >
              <label className="text-xs font-medium">
                Índice
                <input
                  className={`${CATALOG_INPUT_CLASS} bg-stone-100`}
                  readOnly
                  value={entry.classIndex}
                />
              </label>
              <label className="text-xs font-medium">
                Rótulo
                <input
                  className={CATALOG_INPUT_CLASS}
                  value={entry.label}
                  onChange={(event) =>
                    onClassChange(index, { label: event.target.value })
                  }
                />
              </label>
              <label className="text-xs font-medium">
                Cor
                <input
                  className={`${CATALOG_INPUT_CLASS} h-10 p-1`}
                  type="color"
                  value={entry.color}
                  onChange={(event) =>
                    onClassChange(index, {
                      color: event.target.value.toUpperCase(),
                    })
                  }
                />
              </label>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-stone-500">
        O valor é sempre percentual e a unidade é sempre % nesta versão.
      </p>
    </fieldset>
  );
}
