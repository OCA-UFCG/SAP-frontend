"use client";

import { CatalogAssetAddressField } from "@/components/IndexCatalog/CatalogAssetAddressField";
import {
  STANDARD_PROPERTY_LABELS,
  type AssetLayout,
  type StandardPropertyKey,
} from "@/components/IndexCatalog/catalogDraftDefaults";
import {
  CATALOG_FIELDSET_CLASS,
  CATALOG_INPUT_CLASS,
} from "@/components/IndexCatalog/catalogFormStyles";
import type { IndexCatalogDraftInput } from "@/types/indexCatalog";
import type { DetectedPeriodTemplate } from "@/utils/indexCatalog";

const LAYOUT_HINTS: Record<AssetLayout, string> = {
  single:
    "Todos os períodos estão dentro da mesma tabela. O catálogo descobre quais são lendo as colunas de ano e de data.",
  "per-period":
    "Existe uma tabela para cada período. Cole o endereço de uma delas e o catálogo encontra as irmãs na mesma pasta do GEE.",
};

const ADDRESS_LABELS: Record<AssetLayout, string> = {
  single: "Endereço da FeatureCollection",
  "per-period": "Endereço da tabela de um período",
};

const ADDRESS_PLACEHOLDERS: Record<AssetLayout, string> = {
  single: "projects/projeto/assets/estatisticas",
  "per-period": "projects/projeto/assets/estatisticas_2026",
};

const ADDRESS_HELP: Record<AssetLayout, string> = {
  single:
    "Endereço exato da tabela, que precisa conter todos os períodos do índice.",
  "per-period":
    "Cole o endereço completo de um período que já existe. O catálogo troca o período por um marcador e procura as outras tabelas com esse nome.",
};

function describeStatisticsDetection(detection: DetectedPeriodTemplate) {
  const found = detection.month
    ? `ano ${detection.year} e mês ${detection.month}`
    : `ano ${detection.year}`;
  const extra = detection.month
    ? "Cada tabela guarda um mês, então a granularidade é mensal."
    : "Se cada tabela anual guardar os meses daquele ano, deixe a granularidade em Mensal — os períodos vêm da coluna de data.";

  return `Reconhecemos o ${found} neste endereço. O catálogo vai procurar ${detection.assetIdTemplate} na mesma pasta e reunir todos os períodos encontrados. ${extra}`;
}

interface StatisticsSourceFieldsetProps {
  source: IndexCatalogDraftInput["statisticsSource"];
  layout: AssetLayout;
  onLayoutChange: (layout: AssetLayout) => void;
  address: string;
  onAddressChange: (address: string) => void;
  detection: DetectedPeriodTemplate | null;
  manualTemplate: boolean;
  onManualTemplateChange: (manual: boolean) => void;
  onGranularityChange: (granularity: "year" | "month") => void;
  onPropertyChange: (key: StandardPropertyKey, value: string) => void;
}

export function StatisticsSourceFieldset({
  source,
  layout,
  onLayoutChange,
  address,
  onAddressChange,
  detection,
  manualTemplate,
  onManualTemplateChange,
  onGranularityChange,
  onPropertyChange,
}: StatisticsSourceFieldsetProps) {
  // Um asset por mês só existe como tabela mensal; deixar a escolha aberta aqui
  // só produziria o erro "Template de asset com {month} exige uma fonte de
  // granularidade mensal" no momento da leitura.
  const granularityLockedToMonth =
    layout === "per-period" &&
    !manualTemplate &&
    detection?.month !== undefined;

  return (
    <fieldset className={CATALOG_FIELDSET_CLASS}>
      <legend className="px-2 font-bold">2. Fonte das estatísticas</legend>
      <p className="text-xs text-stone-500">
        Obrigatoriamente uma FeatureCollection. As classes e os períodos são
        descobertos lendo o asset, não digitados aqui.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">
          Organização das tabelas
          <select
            className={CATALOG_INPUT_CLASS}
            value={layout}
            onChange={(event) =>
              onLayoutChange(event.target.value as AssetLayout)
            }
          >
            <option value="single">Uma tabela com todos os períodos</option>
            <option value="per-period">Uma tabela por período</option>
          </select>
          <span className="mt-1 block text-xs font-normal text-stone-500">
            {LAYOUT_HINTS[layout]}
          </span>
        </label>
        <label className="text-sm font-medium">
          Granularidade dos períodos
          <select
            className={CATALOG_INPUT_CLASS}
            value={source.periodGranularity}
            disabled={granularityLockedToMonth}
            onChange={(event) =>
              onGranularityChange(event.target.value as "year" | "month")
            }
          >
            <option value="year">Anual</option>
            <option value="month">Mensal</option>
          </select>
          <span className="mt-1 block text-xs font-normal text-stone-500">
            {granularityLockedToMonth
              ? "Uma tabela por mês só pode ser lida como mensal."
              : "Descreve as linhas da tabela, não o nome do arquivo: Anual usa a coluna de ano e gera períodos como 2026; Mensal usa a coluna de data e gera 2026-09."}
          </span>
        </label>
        <CatalogAssetAddressField
          label={ADDRESS_LABELS[layout]}
          help={ADDRESS_HELP[layout]}
          placeholder={ADDRESS_PLACEHOLDERS[layout]}
          value={address}
          onChange={onAddressChange}
          perPeriod={
            layout === "per-period"
              ? {
                  detection,
                  describe: describeStatisticsDetection,
                  missingHint:
                    "Não reconhecemos um período neste endereço. Inclua o ano (por exemplo, ..._2026) ou escreva o template à mão.",
                  manual: manualTemplate,
                  onManualChange: onManualTemplateChange,
                  manualPlaceholder:
                    "projects/projeto/assets/estatisticas_{year}",
                }
              : undefined
          }
        />
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Nomes das colunas territoriais (avançado)
        </summary>
        <p className="mt-2 text-xs text-stone-500">
          Só mude se a tabela usar nomes diferentes do padrão do projeto.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(STANDARD_PROPERTY_LABELS) as StandardPropertyKey[]).map(
            (key) => (
              <label key={key} className="text-xs font-medium" title={key}>
                {STANDARD_PROPERTY_LABELS[key]}
                <input
                  className={CATALOG_INPUT_CLASS}
                  value={source.properties[key]}
                  onChange={(event) =>
                    onPropertyChange(key, event.target.value)
                  }
                />
              </label>
            ),
          )}
        </div>
      </details>
    </fieldset>
  );
}
