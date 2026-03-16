"use client";

import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";

export interface AccordionContextProps {
  activeSection: PlatformSection;
}

function ContextHeader() {
  return (
    <header className="px-4 pt-10 pb-4">
      <h2 className="text-[22px] font-semibold text-neutral-800">
        O que você deseja monitorar?
      </h2>
      <p className="mt-2 text-sm text-neutral-600">
        Selecione que monitor você deseja analisar
      </p>
    </header>
  );
}

function SelectRow({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-4 text-left shadow-sm flex items-center justify-between"
    >
      <span className="text-sm font-medium text-neutral-800">{label}</span>
      <span className="text-neutral-500" aria-hidden>
        ▾
      </span>
    </button>
  );
}

/**
 * AccordionContext
 *
 * First "screen" for the side panel. It's meant to match the Figma intent:
 * header text + a stack of accordion/select controls.
 *
 * This is still a placeholder: it doesn't manage open/close state yet.
 */
export function AccordionContext(_props: AccordionContextProps) {
  return (
    <div className="h-full flex flex-col">
      <ContextHeader />

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="space-y-4">
          <SelectRow label="Seca" />
          <SelectRow label="Desertificação" />
          <SelectRow label="Categorias x" />
        </div>

        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-4 text-xs text-neutral-600">
          Contexto atual: <span className="font-medium">accordion</span>
        </div>
      </div>
    </div>
  );
}
