"use client";

import type { PanelLayerForecastFacets } from "@/contracts/panelLayerForecast";
import {
  isFullyManagedCatalogConfig,
  type IndexCatalogItem,
} from "@/types/indexCatalog";

const FACET_FIELDS: Array<{
  key: keyof PanelLayerForecastFacets;
  label: string;
  placeholder: string;
}> = [
  { key: "source", label: "Fonte dos dados", placeholder: "INMET" },
  { key: "variable", label: "Variável", placeholder: "Precipitação" },
  { key: "kind", label: "Tipo", placeholder: "Anomalia" },
];

const EMPTY_FACETS: PanelLayerForecastFacets = {
  source: "",
  variable: "",
  kind: "",
};

/** Os valores que outras previsões já usam, para a escrita sair igual. */
function usedValues(
  items: IndexCatalogItem[],
  key: keyof PanelLayerForecastFacets,
): string[] {
  const values = new Set<string>();
  for (const item of items) {
    const config = item.catalogConfig;
    if (!isFullyManagedCatalogConfig(config)) continue;
    const value = config.forecastFacets?.[key]?.trim();
    if (value) values.add(value);
  }
  return [...values].sort((left, right) => left.localeCompare(right, "pt-BR"));
}

/**
 * Onde a previsão fica nos filtros do cartão "Previsão climática" do
 * Monitoramento.
 *
 * Os campos sugerem o que as outras previsões já usam porque o filtro junta
 * opções pelo texto: "CPTEC INPE" ao lado de "CPTEC" viraria duas fontes.
 */
export function ForecastFacetsFields({
  value,
  onChange,
  items,
  inputClass,
}: {
  value?: PanelLayerForecastFacets;
  onChange: (value: PanelLayerForecastFacets) => void;
  items: IndexCatalogItem[];
  inputClass: string;
}) {
  const facets = value ?? EMPTY_FACETS;

  return (
    <fieldset className="mt-7 rounded-lg border border-stone-200 p-4">
      <legend className="px-2 font-bold">Previsão climática</legend>
      <p className="text-xs text-stone-500">
        No Monitoramento, as previsões aparecem juntas no cartão “Previsão
        climática”, e quem consulta escolhe a fonte, a variável, a periodicidade
        e o tipo. Preencha os três campos para este índice entrar nesses
        filtros; deixe os três vazios para ele aparecer como um cartão comum. A
        periodicidade (mensal ou trimestral) é reconhecida sozinha pela coluna
        de temporada da tabela de estatísticas.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {FACET_FIELDS.map(({ key, label, placeholder }) => {
          const listId = `forecast-facet-${key}`;
          return (
            <label key={key} className="text-sm font-medium">
              {label}
              <input
                className={inputClass}
                list={listId}
                placeholder={placeholder}
                value={facets[key]}
                onChange={(event) =>
                  onChange({ ...facets, [key]: event.target.value })
                }
              />
              <datalist id={listId}>
                {usedValues(items, key).map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
