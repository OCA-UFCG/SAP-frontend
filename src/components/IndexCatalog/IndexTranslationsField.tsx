"use client";

import type {
  IndexCatalogTranslation,
  IndexCatalogTranslations,
} from "@/types/indexCatalog";

const LANGUAGES = [
  { id: "en", label: "Inglês" },
  { id: "es", label: "Espanhol" },
] as const;

type Language = (typeof LANGUAGES)[number]["id"];

/**
 * O índice em inglês e espanhol: nome, descrição e o rótulo de cada classe.
 *
 * Tem botão próprio de gravar pelo mesmo motivo do link do "Saiba mais": no
 * formulário completo, "Salvar rascunho" derruba a validação, e traduzir um
 * nome não pode obrigar a conferir os assets de novo. Os botões de salvar de
 * cada formulário também gravam as traduções.
 *
 * Vive num componente próprio porque os dois formulários do catálogo — o
 * completo e o do índice legado adotado — editam os mesmos campos.
 */
export function IndexTranslationsField({
  value,
  labels,
  onChange,
  onSave,
  disabled,
  inputClass,
  buttonClass,
}: {
  value: IndexCatalogTranslations;
  /** Rótulos das classes em português, na ordem da legenda. */
  labels: string[];
  onChange: (value: IndexCatalogTranslations) => void;
  onSave: () => void;
  disabled: boolean;
  inputClass: string;
  buttonClass: string;
}) {
  const update = (language: Language, patch: IndexCatalogTranslation) =>
    onChange({ ...value, [language]: { ...value[language], ...patch } });
  const updateLabel = (language: Language, label: string, text: string) =>
    update(language, {
      classLabels: { ...value[language]?.classLabels, [label]: text },
    });

  return (
    <details className="md:col-span-2 rounded-lg border border-stone-200 p-4">
      <summary className="cursor-pointer text-sm font-bold">
        Inglês e espanhol
      </summary>
      <p className="mt-2 text-xs text-stone-500">
        Como o índice aparece para quem usa a plataforma em inglês ou espanhol.
        Campo vazio mostra o texto em português. Como a plataforma lê a versão
        publicada do índice, a tradução aparece lá na próxima publicação.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {LANGUAGES.map(({ id, label }) => (
          <div key={id} className="flex flex-col gap-3">
            <label className="text-sm font-medium">
              Nome em {label.toLowerCase()}
              <input
                className={inputClass}
                lang={id}
                value={value[id]?.name ?? ""}
                onChange={(event) => update(id, { name: event.target.value })}
              />
            </label>
            <label className="text-sm font-medium">
              Descrição em {label.toLowerCase()}
              <textarea
                className={inputClass}
                lang={id}
                rows={3}
                value={value[id]?.description ?? ""}
                onChange={(event) =>
                  update(id, { description: event.target.value })
                }
              />
            </label>
          </div>
        ))}
      </div>

      {labels.length > 0 && (
        <table className="mt-5 w-full text-left text-sm">
          <caption className="mb-2 text-left text-sm font-medium">
            Rótulos das classes
          </caption>
          <thead>
            <tr className="text-xs text-stone-500">
              <th scope="col" className="pb-1 pr-3 font-medium">
                Português
              </th>
              {LANGUAGES.map(({ id, label }) => (
                <th key={id} scope="col" className="pb-1 pr-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label) => (
              <tr key={label}>
                <th scope="row" className="py-1 pr-3 font-normal">
                  {label}
                </th>
                {LANGUAGES.map(({ id, label: language }) => (
                  <td key={id} className="py-1 pr-3">
                    <input
                      className={inputClass}
                      lang={id}
                      aria-label={`“${label}” em ${language.toLowerCase()}`}
                      value={value[id]?.classLabels?.[label] ?? ""}
                      onChange={(event) =>
                        updateLabel(id, label, event.target.value)
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button
        type="button"
        className={`${buttonClass} mt-3 border border-stone-300`}
        disabled={disabled}
        onClick={onSave}
      >
        Salvar traduções
      </button>
    </details>
  );
}
