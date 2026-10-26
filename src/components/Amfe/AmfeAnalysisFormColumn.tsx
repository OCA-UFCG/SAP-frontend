"use client";

import dynamic from "next/dynamic";
import { useAmfeAnalysis } from "./AmfeAnalysisContext";

// O formulário da AMFE só é montado quando alguém abre Análise. Importá-lo sob
// demanda mantém os critérios e os controles deslizantes fora do pacote que todo
// mundo baixa ao abrir Monitoramento.
const LazyAnalyzeForm = dynamic(() => import("./AnalyzeForm/AnalyzeForm"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#F6F7F6]" />,
});

/** Começa a baixar o formulário antes do clique (hover na trilha). */
export function preloadAnalyzeForm() {
  void import("./AnalyzeForm/AnalyzeForm");
}

/**
 * Coluna do formulário da análise multicritério. Fica ao lado do mapa da
 * plataforma em vez de contê-lo: é o que permite entrar e sair de Análise sem
 * reconstruir o mapa.
 */
export function AmfeAnalysisFormColumn({
  onAnalyze,
}: {
  /** Avisa que a pessoa pediu a análise — no celular a tela vai para o mapa. */
  onAnalyze?: () => void;
} = {}) {
  const { setFormPayload } = useAmfeAnalysis();

  return (
    // No celular o formulário ocupa a largura toda e some quando a pessoa pede
    // para ver o mapa (`data-mobile-view` na casca da plataforma).
    <aside
      data-stage="form"
      data-testid="platform-amfe-form"
      className="absolute inset-y-0 left-[132px] z-[6] w-[531px] overflow-y-auto overscroll-contain border-r border-gray-200 bg-[#F6F7F6] max-md:left-0 max-md:w-full max-md:border-r-0 max-md:pb-20 group-data-[mobile-view=result]/shell:max-md:hidden"
    >
      <LazyAnalyzeForm
        setFormPayload={(payload) => {
          setFormPayload(payload);
          onAnalyze?.();
        }}
      />
    </aside>
  );
}
