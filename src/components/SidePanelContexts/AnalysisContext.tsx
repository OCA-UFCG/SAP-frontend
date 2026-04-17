"use client";

import { useMapLayer } from "@/components/MapLayerContext/MapLayerContext";
import { Chevron } from "@/components/Chevron/Chevron";
import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";
import type { PanelLayerI, IEEInfo } from "@/utils/interfaces";
import { statesObj } from "@/utils/constants";
import SearchBarPlatform from "./SearchBarPlatform";
import { resolveStateKeyFromSearch } from "@/utils/functions";
import { useState, useMemo, useEffect } from "react";
import droughtData from "../../../public/dados-seca.json";
import { classificationMeta } from "@/utils/constants";
import type { ClassificationKey } from "@/utils/constants";
import locationDataJson from "../../../public/dados-seca.json";

export interface AnalysisContextProps {
  activeSection: PlatformSection;
  panelLayers?: PanelLayerI[];
  eeConfigs?: IEEInfo[];
  onRequestSectionChange?: (next: PlatformSection) => void;
}

const stateClassificationPlaceholders = [
  "Sem seca",
  "Recuperacao total",
  "Recuperacao parcial",
  "Observação",
  "Atenção",
  "Seca Severa",
];

const TIER_CONFIG = {
  "sem-seca": { label: "Sem seca", color: "#F0F0D7" },
  observacao: { label: "Observação", color: "#FECB89" },
  atencao: { label: "Atenção", color: "#FC8F23" },
  alerta: { label: "Seca severa", color: "#B52C08" },
  "recuperacao-total": { label: "Recuperação Total", color: "#B4BA61" },
  "recuperacao-parcial": { label: "Recuperação Parcial", color: "#5B612A" },
};

function getPredominantClassification(
  status: Record<ClassificationKey, number>,
): ClassificationKey {
  return (Object.entries(status) as [ClassificationKey, number][]).reduce(
    (max, cur) => (cur[1] > max[1] ? cur : max),
  )[0];
}

function getPredominantInfo(status: Record<ClassificationKey, number>) {
  const key = getPredominantClassification(status);
  const meta = classificationMeta[key];

  return {
    key,
    ...meta,
    text: `Região maioritariamente ${meta.label}`,
  };
}

export interface LocationData {
  nome: string;
  status: Record<ClassificationKey, number>;
  acontecendo: string;
  impacto: string[];
}

export interface AnalysisContextProps {
  activeSection: PlatformSection;
  panelLayers?: PanelLayerI[];
  onRequestSectionChange?: (next: PlatformSection) => void;
}

export function AnalysisContext({
  onRequestSectionChange,
  panelLayers,
}: AnalysisContextProps) {
  const { setActiveData, setSelectedState, setActiveLayerId, setActiveEEData, selectedState, setActiveLegend, activeLayerId } = useMapLayer();
  // activeData eh o dado vetorial para o mapa renderizar (CDIVectorData)
  // activeLayerId eh o identificador da layer selecionada ("CDI" e etc)

  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  const dataset = useMemo(() => {
    return panelLayers?.find((p) => p.id === activeLayerId) ?? panelLayers?.[0];
  }, [panelLayers, activeLayerId]);

  const years = useMemo(() => dataset?.years ?? [], [dataset]);

  const locationData = useMemo(() => {
    return (
      locationDataJson[selectedState as keyof typeof locationDataJson] ||
      locationDataJson["br"]
    );
  }, [selectedState]);

  function handleGoBack() {
    setActiveLayerId(null);
    setActiveEEData(null);
    setActiveData(null);
    setActiveLegend(null);
    setSelectedState("br");
    onRequestSectionChange?.("modules");
  }

  const { statusItems, currentState } = useMemo(() => {
    const stateData =
      droughtData[selectedState as keyof typeof droughtData] || droughtData.br;

    const items = Object.entries(stateData.status).map(([key, value]) => {
      const percentage = (value as number) * 100;
      const config = TIER_CONFIG[key as keyof typeof TIER_CONFIG];

      return {
        id: key,
        value: Number(percentage.toFixed(1)),
        label: config.label,
        color: config.color,
      };
    });

    return {
      statusItems: items,
      currentState: stateData,
    };
  }, [selectedState]);

  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\d+(?:\.\d+)?% [^,.]+)/g);

    return parts.map((part, i) =>
      /\d+(?:\.\d+)?%/.test(part) ? (
        <strong key={i} className="font-bold text-[#292829]">
          {part}
        </strong>
      ) : (
        part
      ),
    );
  };

  const handleSearch = (value: string) => {
    const result = resolveStateKeyFromSearch(value, statesObj);
    setSelectedState(result.key);
  };

  const predominantInfo = locationData
    ? getPredominantInfo(locationData.status)
    : null;

    const currentYear = useMemo(() => {
    if (selectedYear) return selectedYear;
    if (!dataset?.imageData) return null;
    const entries = Object.entries(dataset.imageData);
    const defaultEntry = entries.find(([, val]) => val.default) ?? entries[0];
    return defaultEntry?.[0];
  }, [dataset, selectedYear]);
    
    useEffect(() => {
    if (dataset?.imageData && currentYear) {
      const yearConfig = dataset.imageData[currentYear];
      if (yearConfig?.imageParams) {
        setActiveLegend(yearConfig.imageParams);
      }
    }
  }, [dataset, currentYear, setActiveLegend]);

  return (
    <div className="h-full overflow-y-auto bg-[#F6F7F6] px-4 pt-12 pb-6">
      <div className="flex flex-col gap-6">
        <button
          type="button"
          onClick={handleGoBack}
          className="flex w-fit items-center cursor-pointer gap-2 rounded-lg border border-[#EFEFEF] bg-white px-2 py-1.5 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-[#F8F7F8]"
        >
          <Chevron open from="right" to="left" size={16} />
          <span>Voltar para módulos</span>
        </button>

        <header className="flex flex-col gap-2">
          {/* Aqui fica o titulo principal da analise do modulo CDI. (Análise do módulo CDI)*/}
          <h1 className="font-['Inter'] font-semibold text-[24px] leading-[24px] tracking-[-0.015em]">
            Análise do módulo CDI
          </h1>
          {/* Aqui fica o texto de apoio orientando a busca por estado ou cidade. (Pesquise um estado ou cidade para iniciar a análise)*/}
          <p className="font-['Inter'] font-medium text-[16px] leading-[24px] tracking-[-0.015em]">
            Pesquise um estado ou cidade para iniciar análise
          </p>
        </header>
        <section className="flex flex-col gap-8">
          <div className="flex gap-4">
            <SearchBarPlatform onSearch={handleSearch} />
          </div>

          {/*data da analise*/}
          <div className="flex flex-col items-start gap-[6px] w-full max-w-[392px]">
            <label className="text-[14px] leading-[20px] font-medium text-[#292829]">
              Data da análise
            </label>

            <select
              value={selectedYear || ""}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full h-[40px] min-h-[36px] px-3 py-2 text-[14px] leading-[24px] text-[#292829] bg-white border border-[#DCDBDC] rounded-md focus:outline-none"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          {/*localidade*/}
          <div className="flex flex-col mb-4">
            <div
              className="text-[18px] font-semibold leading-6"
              style={{ color: predominantInfo?.color }}
            >
              {locationData?.nome}
            </div>
          </div>

          <div className="w-full max-w-[392px] flex flex-col gap-2">
            {/* info geral*/}
            <div className="text-[18px] font-semibold leading-6 text-[#292829]">
              Informações gerais
            </div>
            {predominantInfo && locationData && (
              <div className="w-full h-[40px] flex items-center gap-4 pr-6 bg-white rounded-lg">
                <div
                  className="w-10 h-10 p-2 flex items-center justify-center rounded-lg border shrink-0"
                  style={{
                    backgroundColor: predominantInfo.bg,
                    borderColor: predominantInfo.border,
                  }}
                >
                  <svg className="w-6 h-6">
                    <use
                      xlinkHref="/sprite.svg#check"
                      stroke={predominantInfo.color}
                      strokeWidth="0.2"
                      fill="none"
                    />
                  </svg>
                </div>

                <span className="w-fit text-[14px] leading-6 font-semibold text-[#292829] break-words">
                  {predominantInfo.text}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-[18px] font-semibold leading-6 text-[#292829]">
              O que está acontecendo?
            </h2>
            <div className="rounded-lg">
              <p className="text-neutral-600 text-sm text-[12px] leading-relaxed mt-1">
                {renderFormattedText(currentState.acontecendo)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-[14px] font-semibold leading-6 text-[#292829]">
              Porcentagem de área por classificação
            </h2>

            <div className="rounded-lg border border-[#EFEFEF] bg-white p-3 shadow-sm">
              <div className="flex h-10 w-full overflow-hidden rounded-md">
                {statusItems
                  .filter((item) => item.value > 0)
                  .map((item) => (
                    <div
                      key={item.id}
                      style={{
                        width: `${item.value}%`,
                        backgroundColor: item.color,
                      }}
                      className="flex items-center justify-center text-[12px] font-bold text-[#292829] border-r border-white/20 last:border-0 transition-all duration-500"
                      title={`${item.label}: ${item.value}%`}
                    >
                      {item.value > 10 && `${item.value}%`}
                    </div>
                  ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
                {statusItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-[12px] text-neutral-600 truncate">
                      {item.label}:{" "}
                      <span className="font-bold">{item.value}%</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="h-6 w-[215px]">
              {/* Aqui fica o titulo da secao de estados por classificacao. */}
            </div>

            <div className="flex flex-col gap-2">
              {stateClassificationPlaceholders.map((label) => (
                <div
                  key={label}
                  className="min-h-[84px] rounded-lg border border-[#EFEFEF] bg-white"
                >
                  {/* Aqui fica um card expansivel por classificacao, com total de estados e lista detalhada. */}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="h-6 w-[132px]">
              {/* Aqui fica o titulo da secao de visao temporal. */}
            </div>

            <div className="min-h-[54px] rounded-lg">
              {/* Aqui fica o texto de contexto temporal da analise. */}
            </div>

            <div className="min-h-[293px] rounded-lg bg-white">
              {/* Aqui fica a visualizacao grafica ou imagem da serie temporal. */}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
