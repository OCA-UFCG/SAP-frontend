"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  useAmfeAnalysisState,
  type AmfeAnalysisState,
} from "./useAmfeAnalysisState";

const AmfeAnalysisContext = createContext<AmfeAnalysisState | null>(null);

/**
 * Disponibiliza o estado da análise multicritério para o formulário e para o
 * mapa da plataforma, que são irmãos na árvore: o mapa precisa continuar montado
 * ao trocar de seção, então não pode viver dentro da tela da AMFE.
 */
export function AmfeAnalysisProvider({ children }: { children: ReactNode }) {
  const analysis = useAmfeAnalysisState();

  return (
    <AmfeAnalysisContext.Provider value={analysis}>
      {children}
    </AmfeAnalysisContext.Provider>
  );
}

/**
 * Estado da análise quando existe um provider acima, e `null` fora dele — o
 * mapa da plataforma também é usado pela prévia do catálogo, que só desenha
 * Monitoramento.
 */
export function useOptionalAmfeAnalysis(): AmfeAnalysisState | null {
  return useContext(AmfeAnalysisContext);
}

/** Para os componentes que só existem dentro da Análise. */
export function useAmfeAnalysis(): AmfeAnalysisState {
  const analysis = useOptionalAmfeAnalysis();

  if (!analysis) {
    throw new Error(
      "useAmfeAnalysis precisa de um AmfeAnalysisProvider acima na árvore.",
    );
  }

  return analysis;
}
