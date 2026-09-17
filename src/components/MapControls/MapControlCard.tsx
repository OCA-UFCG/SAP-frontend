"use client";

import { useState, type ReactNode } from "react";
import { Chevron } from "@/components/Chevron/Chevron";

/**
 * O cartão branco dos controles sobre o mapa. Mora aqui para que Territórios,
 * Mapa base, Transparência e Legendas nasçam do mesmo lugar: enquanto cada um
 * repetia as próprias classes, a caixa de Legendas acabou com outra fonte, outro
 * tamanho de rótulo e outro cabeçalho que as demais.
 *
 * @example
 * <MapControlCard ariaLabel="Mapa base">{children}</MapControlCard>
 */
export function MapControlCard({
  children,
  ariaLabel,
}: {
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <div
      className="box-border flex w-[302px] shrink-0 flex-col gap-2.5 self-stretch rounded-lg border border-[#EFEFEF] bg-white px-4 py-3"
      role={ariaLabel ? "group" : undefined}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

/** A tipografia única dos rótulos dos controles do mapa. */
export const MAP_CONTROL_LABEL_CLASS =
  "font-open-sans text-[10px] leading-[18px] tracking-[-0.006em] text-[#292829]";

/**
 * Um cartão que abre e fecha pelo próprio cabeçalho, com o mesmo chevron e a
 * mesma tipografia em todos os controles. Usado por Territórios e Legendas.
 *
 * O conteúdo vem como função porque só deve ser montado com o cartão aberto:
 * uma legenda de vinte classes não precisa existir no DOM enquanto está fechada.
 *
 * @example
 * <MapControlDisclosure label="Legendas">{() => itens}</MapControlDisclosure>
 */
export function MapControlDisclosure({
  label,
  children,
}: {
  label: string;
  children: () => ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <MapControlCard ariaLabel={label}>
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between bg-transparent text-left outline-none"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        {/* Cabeçalho como heading: o leitor de tela navega pelas caixas do
            mapa, e antes só Legendas tinha esse título. */}
        <h2 className={`${MAP_CONTROL_LABEL_CLASS} font-semibold`}>{label}</h2>
        <span className="flex shrink-0 items-center justify-center text-[#292829]">
          <Chevron open={isOpen} from="down" to="up" size={16} />
        </span>
      </button>
      {isOpen && children()}
    </MapControlCard>
  );
}
