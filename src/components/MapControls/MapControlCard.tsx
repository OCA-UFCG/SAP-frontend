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
  collapsed = false,
}: {
  children: ReactNode;
  ariaLabel?: string;
  /** Fechado, no celular o cartão encolhe até o tamanho do próprio rótulo. */
  collapsed?: boolean;
}) {
  return (
    <div
      className={`box-border flex w-[302px] shrink-0 flex-col gap-2.5 self-stretch rounded-lg border border-[#EFEFEF] bg-white px-4 py-3 max-md:gap-1.5 max-md:py-2 ${collapsed ? "max-md:w-auto max-md:self-end" : ""}`}
      role={ariaLabel ? "group" : undefined}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

/**
 * A tipografia única dos rótulos dos controles do mapa. No celular sobe para
 * 12px: 10px se lê com a tela na mesa, não com ela na mão.
 */
export const MAP_CONTROL_LABEL_CLASS =
  "font-open-sans text-[0.625rem] leading-[18px] tracking-[-0.006em] text-[#292829] max-md:text-xs max-md:leading-4";

/**
 * Um cartão que abre e fecha pelo próprio cabeçalho, com o mesmo chevron e a
 * mesma tipografia em todos os controles. Usado por Territórios e Legendas.
 * `onOpen` avisa quando a pessoa abre o cartão — Territórios usa isso para
 * adiantar o download dos grupos que ela provavelmente vai ligar.
 *
 * O conteúdo vem como função porque só deve ser montado com o cartão aberto:
 * uma legenda de vinte classes não precisa existir no DOM enquanto está fechada.
 * `summary` é o contrário: fica logo abaixo do cabeçalho mesmo com o cartão
 * fechado — Territórios mostra ali o território escolhido na busca.
 * `defaultOpen` faz o cartão nascer aberto — Legendas usa isso para aparecer
 * junto com o índice que a pessoa acabou de ligar.
 * `animated` faz o cartão abrir e fechar deslizando, com os itens entrando em
 * cascata, como os acordeões do painel da esquerda — Territórios usa isso.
 * Para dar tempo de fechar deslizando, o conteúdo continua montado depois da
 * primeira abertura.
 *
 * @example
 * <MapControlDisclosure label="Legendas">{() => itens}</MapControlDisclosure>
 */
export function MapControlDisclosure({
  label,
  children,
  onOpen,
  summary,
  defaultOpen = false,
  animated = false,
}: {
  label: string;
  children: () => ReactNode;
  onOpen?: () => void;
  summary?: ReactNode;
  defaultOpen?: boolean;
  animated?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [hasOpened, setHasOpened] = useState(defaultOpen);

  return (
    <MapControlCard ariaLabel={label} collapsed={!isOpen}>
      {/* O heading por fora do botão: dentro dele o conteúdo vira texto puro
          e o leitor de tela não achava o título ao navegar pelas caixas do
          mapa. */}
      <h2>
        <button
          type="button"
          className="group flex w-full cursor-pointer items-center justify-between gap-2 rounded bg-transparent text-left outline-none focus-visible:ring-2 focus-visible:ring-[#5B612A] focus-visible:ring-offset-2"
          onClick={() => {
            if (!isOpen) onOpen?.();
            setIsOpen(!isOpen);
            setHasOpened(true);
          }}
          aria-expanded={isOpen}
        >
          <span
            className={`${MAP_CONTROL_LABEL_CLASS} font-semibold ${
              animated
                ? "transition-[translate] duration-200 ease-out motion-safe:group-hover:translate-x-1"
                : ""
            }`}
          >
            {label}
          </span>
          <span
            className={`-m-1 flex size-6 shrink-0 items-center justify-center rounded-full text-[#292829] transition-colors duration-200 group-hover:bg-[#E1E2B4] group-hover:text-[#4F5424] ${isOpen ? "bg-[#F5F6EE]" : ""}`}
          >
            <Chevron open={isOpen} from="down" to="up" size={16} />
          </span>
        </button>
      </h2>
      {summary}
      {animated ? (
        // A linha da grade vai de 0 à altura do conteúdo; a margem negativa
        // devolve o espaço entre os itens do cartão enquanto ele está fechado.
        // `contain` impede o conteúdo escondido de alargar o cartão, que no
        // celular encolhe até o rótulo quando fechado.
        <div
          className={`grid [contain:inline-size] transition-[grid-template-rows,opacity,margin] duration-300 ease-in-out motion-reduce:transition-none ${
            isOpen
              ? "grid-rows-[1fr] opacity-100"
              : "-mt-2.5 grid-rows-[0fr] opacity-0 max-md:-mt-1.5"
          }`}
        >
          {/* Fechado, o conteúdo continua montado, então `inert` é o que
              impede o Tab de parar em campos invisíveis. */}
          <div
            inert={!isOpen}
            className={`min-h-0 overflow-hidden ${isOpen ? "accordion-cascade" : ""}`}
          >
            {hasOpened && children()}
          </div>
        </div>
      ) : (
        isOpen && children()
      )}
    </MapControlCard>
  );
}
