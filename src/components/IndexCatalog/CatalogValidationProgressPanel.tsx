"use client";

import type { ValidationProgress } from "@/components/IndexCatalog/catalogValidationProgress";

/** Barra de progresso estimado da validação dos assets no Earth Engine. */
export function CatalogValidationProgressPanel({
  progress,
}: {
  progress: ValidationProgress;
}) {
  return (
    <div
      className="mt-4 rounded-lg border border-[#D6D89A] bg-[#F4F5D8] p-4"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3 text-sm font-semibold">
        <span>Progresso estimado da validação</span>
        <span>{progress.percent}%</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-white"
        role="progressbar"
        aria-label="Progresso estimado da validação"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
      >
        <div
          className="h-full rounded-full bg-[#989F43] transition-[width] duration-500 ease-out"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-stone-700">{progress.message}</p>
      {progress.percent < 100 && (
        <p className="mt-1 text-xs text-stone-500">
          Tabelas grandes podem levar alguns minutos. Você pode manter esta tela
          aberta enquanto a conferência é feita.
        </p>
      )}
    </div>
  );
}
