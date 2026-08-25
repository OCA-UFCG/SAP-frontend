"use client";

import { useId } from "react";
import { CATALOG_INPUT_CLASS } from "@/components/IndexCatalog/catalogFormStyles";
import type { DetectedPeriodTemplate } from "@/utils/indexCatalog";

/** Configuração exibida somente quando existe um asset por período. */
export interface PeriodAddressMode {
  /** Período reconhecido no endereço colado; `null` quando não há nenhum. */
  detection: DetectedPeriodTemplate | null;
  describe: (detection: DetectedPeriodTemplate) => string;
  missingHint: string;
  manual: boolean;
  onManualChange: (manual: boolean) => void;
  manualPlaceholder: string;
}

interface CatalogAssetAddressFieldProps {
  label: string;
  help: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  perPeriod?: PeriodAddressMode;
}

const MANUAL_LABEL = "Template do endereço";
const MANUAL_HELP =
  "Modo avançado: escreva o endereço com {year}, {month} ou {period} onde o período aparece.";

/**
 * Campo de endereço de asset do GEE, usado pelas estatísticas e pelo mapa.
 *
 * O caminho principal é colar o endereço **concreto** de um período que o
 * operador já tem na mão; o template com `{year}`/`{month}` é derivado disso e
 * mostrado como confirmação. Escrever o template à mão continua possível, mas
 * como escape hatch para nomes que a detecção não cobre — não como o que se
 * espera de quem só conhece o produto e o GEE.
 */
export function CatalogAssetAddressField({
  label,
  help,
  placeholder,
  value,
  onChange,
  className = "text-sm font-medium md:col-span-2",
  perPeriod,
}: CatalogAssetAddressFieldProps) {
  const inputId = useId();
  const manual = perPeriod?.manual === true;
  const detection = perPeriod?.detection ?? null;
  const showFeedback = Boolean(perPeriod) && !manual && value.trim() !== "";

  return (
    <div className={className}>
      <label htmlFor={inputId}>{manual ? MANUAL_LABEL : label}</label>
      <input
        id={inputId}
        className={CATALOG_INPUT_CLASS}
        placeholder={manual ? perPeriod!.manualPlaceholder : placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="mt-1 block text-xs font-normal text-stone-500">
        {manual ? MANUAL_HELP : help}
      </span>
      {showFeedback && (
        <span
          className={`mt-2 block rounded-md px-3 py-2 text-xs font-normal ${
            detection
              ? "bg-[#F4F5D8] text-[#4B4E15]"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          {detection ? perPeriod!.describe(detection) : perPeriod!.missingHint}
        </span>
      )}
      {perPeriod && (
        <button
          type="button"
          className="mt-2 cursor-pointer text-xs font-semibold text-[#62672D] underline"
          onClick={() => perPeriod.onManualChange(!manual)}
        >
          {manual
            ? "Voltar a colar o endereço de um período"
            : "Escrever o template do endereço à mão"}
        </button>
      )}
    </div>
  );
}
