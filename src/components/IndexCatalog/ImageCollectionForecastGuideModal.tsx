"use client";

import { useEffect, type ReactNode } from "react";

interface ForecastGuideFieldProps {
  label: string;
  value: string;
  children: ReactNode;
}

function ForecastGuideField({
  label,
  value,
  children,
}: ForecastGuideFieldProps) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <p className="text-xs font-semibold text-stone-700">{label}</p>
      <code className="mt-1 block break-all rounded-md border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900">
        {value}
      </code>
      <p className="mt-2 text-xs leading-relaxed text-stone-600">{children}</p>
    </div>
  );
}

export function ImageCollectionForecastGuideModal({
  onClose,
}: {
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[140] grid place-items-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="forecast-collection-guide-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-stone-200 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#757B35]">
              Ajuda da ImageCollection
            </p>
            <h2
              id="forecast-collection-guide-title"
              className="mt-1 text-xl font-bold"
            >
              Previsão por emissão e horizonte
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-600">
              Use este tratamento quando uma única coleção guarda várias rodadas
              de previsão. O catálogo fixa a emissão mais recente no momento da
              validação e associa cada horizonte ao mês informado pela própria
              imagem.
            </p>
          </div>
          <button
            type="button"
            className="cursor-pointer rounded-md px-3 py-1 text-xl font-bold hover:bg-stone-100"
            aria-label="Fechar ajuda da previsão"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <ForecastGuideField label="Banda" value="b1">
            Nome da banda com os valores brutos que serão classificados para
            desenhar o mapa.
          </ForecastGuideField>
          <ForecastGuideField
            label="Propriedade da emissão"
            value="data_emissao"
          >
            Identifica a rodada que produziu a previsão. O sistema encontra o
            maior valor disponível e o fixa na revisão validada.
          </ForecastGuideField>
          <ForecastGuideField
            label="Propriedade do horizonte"
            value="lead_time"
          >
            Identifica a distância entre a emissão e o mês previsto. Cada
            horizonte deve aparecer uma única vez na emissão escolhida.
          </ForecastGuideField>
          <ForecastGuideField
            label="Propriedade do mês previsto"
            value="system:time_start"
          >
            Data usada para ligar cada imagem ao período existente na tabela
            estatística, como 2026-09.
          </ForecastGuideField>
          <ForecastGuideField label="Horizontes" value="1, 2, 3, 4">
            Lista dos horizontes que devem ser publicados. Separe números
            inteiros por vírgula.
          </ForecastGuideField>
          <ForecastGuideField
            label="Limites das classes"
            value="-90, -30, 0, 30, 90"
          >
            Cinco limites separam seis classes. Use exatamente a mesma regra
            empregada na geração das porcentagens estatísticas.
          </ForecastGuideField>
        </div>

        <div className="mt-5 rounded-lg border border-[#D6D89A] bg-[#F4F5D8] p-4">
          <h3 className="font-bold">Exemplo completo</h3>
          <dl className="mt-3 grid gap-2 text-sm md:grid-cols-[180px_1fr]">
            <dt className="font-semibold">Asset</dt>
            <dd className="break-all font-mono text-xs">
              projects/obscaatinga/assets/ColecaoImagens/CPTEC_Prev_T_Anomalia
            </dd>
            <dt className="font-semibold">Emissão encontrada</dt>
            <dd>20260801</dd>
            <dt className="font-semibold">Associação validada</dt>
            <dd>
              lead 1 → 2026-09 · lead 2 → 2026-10 · lead 3 → 2026-11 · lead 4 →
              2026-12
            </dd>
          </dl>
        </div>

        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
          <strong>Conferência de segurança:</strong> a validação falha se faltar
          um lead, se dois leads apontarem para o mesmo mês ou se os meses da
          coleção não coincidirem com os períodos da FeatureCollection
          estatística. Uma emissão nova só entra depois de nova validação e
          publicação.
        </div>

        <footer className="mt-6 flex justify-end border-t border-stone-200 pt-4">
          <button
            type="button"
            className="cursor-pointer rounded-md bg-[#292829] px-4 py-2 text-sm font-semibold text-white"
            onClick={onClose}
          >
            Entendi
          </button>
        </footer>
      </section>
    </div>
  );
}
