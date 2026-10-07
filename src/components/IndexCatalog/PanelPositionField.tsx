"use client";

import type { IndexCatalogItem } from "@/types/indexCatalog";
import { resolvePanelPositionPlan } from "@/utils/indexCatalog";

/**
 * Posição do índice na lista da categoria dele no Monitoramento, com o aviso de
 * quem já está no número escolhido.
 *
 * O aviso existe porque a lista é ordenada por esse número e o operador não tem
 * como saber de cabeça quem ocupa cada posição. Dizer que a publicação vai
 * trocar os dois de lugar é o que evita a surpresa: quem escreve "0" está
 * pedindo o primeiro lugar de alguém.
 *
 * Vive num componente próprio porque os dois formulários do catálogo — o
 * completo e o do índice legado adotado — editam o mesmo campo.
 */
export function PanelPositionField({
  value,
  onChange,
  items,
  entryId,
  category,
  inputClass,
}: {
  value: string;
  onChange: (value: string) => void;
  items: IndexCatalogItem[];
  /** `null` num índice que ainda não foi salvo. */
  entryId: string | null;
  category: string;
  inputClass: string;
}) {
  const requestedPosition = parsePositionInput(value);
  const invalid = value.trim() !== "" && requestedPosition === undefined;
  const plan =
    requestedPosition === undefined
      ? undefined
      : resolvePanelPositionPlan(items, {
          entryId: entryId ?? "",
          category,
          requestedPosition,
          currentPosition: items.find((item) => item.entryId === entryId)
            ?.panelPosition,
        });

  return (
    <div>
      <label className="text-sm font-medium">
        Posição na categoria
        <input
          className={inputClass}
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      {invalid ? (
        <p className="mt-1 text-xs text-red-700">
          Use um número inteiro maior ou igual a zero, ou deixe o campo vazio
          para manter a posição atual.
        </p>
      ) : (
        <p className="mt-1 text-xs text-stone-500">
          Ordem na lista do Monitoramento, do menor para o maior. Vazio mantém a
          posição atual, e um índice novo entra depois do último da categoria.
        </p>
      )}
      {plan?.swap && (
        <p className="mt-1 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
          “{plan.swap.name}” já está na posição {plan.position} de {category}.
          Se você publicar assim, os dois trocam de lugar: este índice fica na{" "}
          {plan.position} e “{plan.swap.name}” vai para a {plan.swap.position}.
        </p>
      )}
    </div>
  );
}

/** `undefined` para campo vazio e para o que não é uma posição válida. */
function parsePositionInput(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;

  const position = Number(trimmed);
  return Number.isInteger(position) && position >= 0 ? position : undefined;
}
