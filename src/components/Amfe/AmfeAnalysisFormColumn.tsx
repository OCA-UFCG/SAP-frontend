"use client";

import dynamic from "next/dynamic";
import { useAmfeAnalysis } from "./AmfeAnalysisContext";

// O formulário da AMFE só é montado quando alguém abre Análise. Importá-lo sob
// demanda mantém os critérios e os controles deslizantes fora do pacote que todo
// mundo baixa ao abrir Monitoramento.
const LazyAnalyzeForm = dynamic(() => import("./AnalyzeForm/AnalyzeForm"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#efefef]" />,
});

/**
 * Coluna do formulário da análise multicritério. Fica ao lado do mapa da
 * plataforma em vez de contê-lo: é o que permite entrar e sair de Análise sem
 * reconstruir o mapa.
 */
export function AmfeAnalysisFormColumn() {
  const { setFormPayload } = useAmfeAnalysis();

  return (
    <aside
      data-testid="platform-amfe-form"
      className="absolute inset-y-0 left-[140px] z-[6] w-[600px] overflow-y-auto overscroll-contain border-r border-gray-200 bg-[#efefef]"
    >
      <LazyAnalyzeForm setFormPayload={setFormPayload} />
    </aside>
  );
}
