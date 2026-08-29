"use client";

import { useEffect, useState } from "react";

import { normalizeHexColor } from "@/utils/hexColor";

type ClassColorFieldProps = {
  color: string;
  label: string;
  inputClass: string;
  onChange: (color: string) => void;
};

/**
 * Campo de cor de uma classe: o seletor visual e o hexadecimal em texto.
 *
 * SED-093: antes existia só o `<input type="color">`, e um seletor nativo não
 * deixa selecionar, copiar nem colar — a cor só mudava pelo diálogo do sistema
 * operacional, e não havia como levar o hexadecimal de uma classe para outra.
 * O texto fica ao lado do seletor justamente para ser lido e copiado.
 *
 * O que a pessoa digita vive num estado local: o rascunho só é atualizado
 * quando o valor já é uma cor válida, senão `#CA2` viraria uma cor inválida no
 * contrato enquanto ela ainda está no meio da digitação.
 */
export const ClassColorField = ({
  color,
  label,
  inputClass,
  onChange,
}: ClassColorFieldProps) => {
  const [text, setText] = useState(color);
  const [syncedColor, setSyncedColor] = useState(color);
  const [copied, setCopied] = useState(false);

  // A cor também muda por fora (a validação preenche as classes, o seletor
  // visual escreve direto), e nesses casos o texto precisa acompanhar. É o
  // ajuste durante a renderização que o React recomenda para estado derivado
  // de prop — um efeito aqui provocaria uma renderização em cascata.
  if (color !== syncedColor) {
    setSyncedColor(color);
    setText(color);
  }

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  function handleText(value: string) {
    setText(value);
    const normalized = normalizeHexColor(value);
    if (normalized && normalized !== color) onChange(normalized);
  }

  // Sair do campo com algo que não é cor devolve o último valor válido, em vez
  // de deixar o texto contradizendo o seletor ao lado.
  function handleBlur() {
    const normalized = normalizeHexColor(text);
    setText(normalized ?? color);
  }

  async function copyColor() {
    try {
      await navigator.clipboard.writeText(color);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const invalid = normalizeHexColor(text) === null;

  return (
    <div className="text-xs font-medium">
      <span id={`${label}-legenda`}>Cor</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          aria-label={`Seletor de cor da ${label}`}
          className="h-10 w-10 shrink-0 cursor-pointer rounded-md border border-[#CFD0CA] bg-white p-1"
          type="color"
          value={color}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
        <input
          aria-describedby={`${label}-legenda`}
          aria-invalid={invalid}
          aria-label={`Hexadecimal da ${label}`}
          className={`${inputClass} mt-0 font-mono uppercase ${
            invalid ? "border-[#B3261E]" : ""
          }`}
          inputMode="text"
          maxLength={7}
          placeholder="#RRGGBB"
          spellCheck={false}
          value={text}
          onBlur={handleBlur}
          onChange={(event) => handleText(event.target.value)}
          onFocus={(event) => event.target.select()}
        />
        <button
          aria-label={`Copiar o hexadecimal da ${label}`}
          className="shrink-0 cursor-pointer rounded-md border border-[#CFD0CA] px-2 py-2 text-xs font-semibold hover:bg-[#F4F5D8]"
          type="button"
          onClick={() => void copyColor()}
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      {invalid && (
        <p className="mt-1 font-normal text-[#B3261E]">
          Use o formato #RRGGBB, por exemplo #CA281B.
        </p>
      )}
    </div>
  );
};
