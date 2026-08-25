"use client";

import { CatalogAssetAddressField } from "@/components/IndexCatalog/CatalogAssetAddressField";
import type {
  AssetLayout,
  MapClassificationMode,
} from "@/components/IndexCatalog/catalogDraftDefaults";
import {
  CATALOG_FIELDSET_CLASS,
  CATALOG_INPUT_CLASS,
} from "@/components/IndexCatalog/catalogFormStyles";
import type {
  EarthEngineAssetMapping,
  EarthEngineSourceType,
} from "@/types/indexCatalog";
import type { DetectedPeriodTemplate } from "@/utils/indexCatalog";

const CLASSIFICATION_HINTS: Record<MapClassificationMode, string> = {
  "pixel-codes":
    "A imagem já guarda o número da classe em cada pixel (0, 1, 2…), como nos mapas de seca.",
  "value-ranges":
    "A imagem guarda valores contínuos (anomalia, índice, milímetros) e o catálogo separa as classes por faixas.",
};

function describeMapDetection(detection: DetectedPeriodTemplate) {
  const found = detection.month
    ? `ano ${detection.year} e mês ${detection.month}`
    : `ano ${detection.year}`;

  return `Reconhecemos o ${found} neste endereço. O mapa de cada período será montado como ${detection.assetIdTemplate}.`;
}

interface MapSourceFieldsetProps {
  mapping: EarthEngineAssetMapping;
  onMappingChange: (values: Partial<EarthEngineAssetMapping>) => void;
  onSourceTypeChange: (sourceType: EarthEngineSourceType) => void;
  onForecastEnabledChange: (enabled: boolean) => void;
  layout: AssetLayout;
  onLayoutChange: (layout: AssetLayout) => void;
  address: string;
  onAddressChange: (address: string) => void;
  detection: DetectedPeriodTemplate | null;
  manualTemplate: boolean;
  onManualTemplateChange: (manual: boolean) => void;
  classification: MapClassificationMode;
  onClassificationChange: (classification: MapClassificationMode) => void;
  thresholdsInput: string;
  onThresholdsInputChange: (value: string) => void;
  leadValuesInput: string;
  onLeadValuesInputChange: (value: string) => void;
  classCount: number;
  onOpenForecastGuide: () => void;
}

export function MapSourceFieldset({
  mapping,
  onMappingChange,
  onSourceTypeChange,
  onForecastEnabledChange,
  layout,
  onLayoutChange,
  address,
  onAddressChange,
  detection,
  manualTemplate,
  onManualTemplateChange,
  classification,
  onClassificationChange,
  thresholdsInput,
  onThresholdsInputChange,
  leadValuesInput,
  onLeadValuesInputChange,
  classCount,
  onOpenForecastGuide,
}: MapSourceFieldsetProps) {
  const forecast = mapping.collectionSelection;
  const isRaster = mapping.sourceType !== "featureCollection";

  return (
    <fieldset className={CATALOG_FIELDSET_CLASS}>
      <legend className="px-2 font-bold">3. Visualização do mapa</legend>
      <p className="text-xs text-stone-500">
        Fonte independente da tabela: Image, ImageCollection ou
        FeatureCollection.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">
          Tipo do asset
          <select
            className={CATALOG_INPUT_CLASS}
            value={mapping.sourceType}
            onChange={(event) =>
              onSourceTypeChange(event.target.value as EarthEngineSourceType)
            }
          >
            <option value="image">Image</option>
            <option value="imageCollection">ImageCollection</option>
            <option value="featureCollection">FeatureCollection</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Organização das imagens
          <select
            className={CATALOG_INPUT_CLASS}
            value={layout}
            disabled={Boolean(forecast)}
            onChange={(event) =>
              onLayoutChange(event.target.value as AssetLayout)
            }
          >
            <option value="single">Um asset para todos os períodos</option>
            <option value="per-period">Um asset por período</option>
          </select>
          <span className="mt-1 block text-xs font-normal text-stone-500">
            {forecast
              ? "Previsões por emissão usam uma única coleção."
              : "Um asset por período faz o catálogo montar o endereço de cada mês ou ano."}
          </span>
        </label>
        {mapping.sourceType === "imageCollection" && (
          <div className="text-sm font-medium md:col-span-2">
            <div className="flex items-center gap-2">
              <label htmlFor="image-collection-treatment">
                Tratamento da coleção
              </label>
              <button
                type="button"
                className="grid size-6 cursor-pointer place-items-center rounded-full border border-[#989F43] bg-white text-xs font-bold text-[#62672D] hover:bg-[#F4F5D8]"
                aria-label="Ajuda sobre previsão por emissão e horizonte"
                onClick={onOpenForecastGuide}
              >
                ?
              </button>
            </div>
            <select
              id="image-collection-treatment"
              className={CATALOG_INPUT_CLASS}
              value={forecast ? "latest-emission-leads" : "mosaic"}
              onChange={(event) =>
                onForecastEnabledChange(
                  event.target.value === "latest-emission-leads",
                )
              }
            >
              <option value="mosaic">Usar todas as imagens</option>
              <option value="latest-emission-leads">
                Previsão por emissão e horizonte
              </option>
            </select>
            <span className="mt-1 block text-xs font-normal text-stone-500">
              Use previsão quando a coleção guarda várias rodadas e um horizonte
              diferente para cada mês.
            </span>
          </div>
        )}
        <CatalogAssetAddressField
          label={
            layout === "single"
              ? "Endereço do asset de mapa"
              : "Endereço do mapa de um período"
          }
          help={
            layout === "single"
              ? "Endereço exato do asset que desenha o mapa."
              : "Cole o endereço completo do mapa de um período que já existe."
          }
          placeholder={
            layout === "single"
              ? "projects/projeto/assets/mapa"
              : "projects/projeto/assets/mapa_2026_09"
          }
          value={address}
          onChange={onAddressChange}
          perPeriod={
            layout === "per-period"
              ? {
                  detection,
                  describe: describeMapDetection,
                  missingHint:
                    "Não reconhecemos um período neste endereço. Inclua o ano (e o mês, se houver um por mês) ou escreva o template à mão.",
                  manual: manualTemplate,
                  onManualChange: onManualTemplateChange,
                  manualPlaceholder: "projects/projeto/assets/mapa_{period}",
                }
              : undefined
          }
        />
        {isRaster ? (
          <label className="text-sm font-medium">
            Banda (obrigatória se houver várias)
            <input
              className={CATALOG_INPUT_CLASS}
              value={mapping.band ?? ""}
              onChange={(event) =>
                onMappingChange({ band: event.target.value })
              }
            />
          </label>
        ) : (
          <label className="text-sm font-medium">
            Propriedade para renderizar
            <input
              className={CATALOG_INPUT_CLASS}
              value={mapping.property ?? ""}
              onChange={(event) =>
                onMappingChange({ property: event.target.value })
              }
            />
          </label>
        )}
        {isRaster && (
          <label className="text-sm font-medium">
            Como o mapa vira classes
            <select
              className={CATALOG_INPUT_CLASS}
              value={classification}
              onChange={(event) =>
                onClassificationChange(
                  event.target.value as MapClassificationMode,
                )
              }
            >
              <option value="pixel-codes">
                O pixel já é o código da classe
              </option>
              <option value="value-ranges">Separar por faixas de valor</option>
            </select>
            <span className="mt-1 block text-xs font-normal text-stone-500">
              {CLASSIFICATION_HINTS[classification]}
            </span>
          </label>
        )}
        {isRaster && classification === "value-ranges" && (
          <label className="text-sm font-medium md:col-span-2">
            Limites das faixas
            <input
              className={CATALOG_INPUT_CLASS}
              placeholder="-90, -30, 0, 30, 90"
              value={thresholdsInput}
              onChange={(event) => onThresholdsInputChange(event.target.value)}
            />
            <span className="mt-1 block text-xs font-normal text-stone-500">
              Em ordem crescente, sempre um limite a menos que a quantidade de
              classes.
              {classCount > 0
                ? ` Este índice tem ${classCount} classe(s), então informe ${classCount - 1} limite(s).`
                : " A quantidade de classes é descoberta na validação."}
            </span>
          </label>
        )}
        {forecast && (
          <>
            <label className="text-sm font-medium">
              Propriedade da emissão
              <input
                className={CATALOG_INPUT_CLASS}
                value={forecast.emissionProperty}
                onChange={(event) =>
                  onMappingChange({
                    collectionSelection: {
                      ...forecast,
                      emissionProperty: event.target.value,
                    },
                  })
                }
              />
            </label>
            <label className="text-sm font-medium">
              Propriedade do horizonte
              <input
                className={CATALOG_INPUT_CLASS}
                value={forecast.leadProperty}
                onChange={(event) =>
                  onMappingChange({
                    collectionSelection: {
                      ...forecast,
                      leadProperty: event.target.value,
                    },
                  })
                }
              />
            </label>
            <label className="text-sm font-medium">
              Propriedade do mês previsto
              <input
                className={CATALOG_INPUT_CLASS}
                value={forecast.targetDateProperty}
                onChange={(event) =>
                  onMappingChange({
                    collectionSelection: {
                      ...forecast,
                      targetDateProperty: event.target.value,
                    },
                  })
                }
              />
            </label>
            <label className="text-sm font-medium">
              Horizontes
              <input
                className={CATALOG_INPUT_CLASS}
                placeholder="1, 2, 3, 4"
                value={leadValuesInput}
                onChange={(event) =>
                  onLeadValuesInputChange(event.target.value)
                }
              />
              <span className="mt-1 block text-xs font-normal text-stone-500">
                Números inteiros separados por vírgula.
              </span>
            </label>
          </>
        )}
      </div>
    </fieldset>
  );
}
