"use client";

import {
  CATALOG_BUTTON_CLASS,
  CATALOG_INPUT_CLASS,
} from "@/components/IndexCatalog/catalogFormStyles";
import type { IndexCatalogLifecycleImpact } from "@/types/indexCatalog";

interface CatalogDeleteDialogProps {
  impact: IndexCatalogLifecycleImpact;
  confirmation: string;
  onConfirmationChange: (confirmation: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  removing: boolean;
}

/**
 * Confirmação da remoção. Exige digitar o ID técnico porque a exclusão do
 * `panelLayer` no Contentful não tem desfazer — os assets no GEE, sim, nunca são
 * tocados.
 */
export function CatalogDeleteDialog({
  impact,
  confirmation,
  onConfirmationChange,
  onCancel,
  onConfirm,
  removing,
}: CatalogDeleteDialogProps) {
  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/40 p-4">
      <div className="max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold">Remover {impact.item.name}?</h2>
        <p className="mt-3 text-sm text-stone-600">
          Somente o panelLayer será removido do Contentful. Os assets GEE nunca
          serão apagados. Digite o ID técnico para confirmar:
        </p>
        <code className="mt-2 block rounded bg-stone-100 p-2 text-sm">
          {impact.item.panelLayerId}
        </code>
        <input
          className={CATALOG_INPUT_CLASS}
          value={confirmation}
          onChange={(event) => onConfirmationChange(event.target.value)}
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className={`${CATALOG_BUTTON_CLASS} border border-stone-300`}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={`${CATALOG_BUTTON_CLASS} bg-red-700 text-white`}
            disabled={confirmation !== impact.item.panelLayerId || removing}
            onClick={onConfirm}
          >
            Remover panelLayer
          </button>
        </div>
      </div>
    </div>
  );
}
