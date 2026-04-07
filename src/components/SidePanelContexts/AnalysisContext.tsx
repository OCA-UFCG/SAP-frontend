"use client";

import { useState, useMemo } from "react";
import { useMapLayer } from "@/components/MapLayerContext/MapLayerContext";
import { Chevron } from "@/components/Chevron/Chevron";
import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";
import type { PanelLayerI } from "@/utils/interfaces";
import droughtData from "../../../public/dados-seca.json";
import { statesObj } from "@/utils/constants";
import SearchBarPlatform from "./SearchBarPlatform";
import { resolveStateKeyFromSearch } from "@/utils/functions";

export interface AnalysisContextProps {
  activeSection: PlatformSection;
  panelLayers?: PanelLayerI[];
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

export function AnalysisContext({
  onRequestSectionChange,
}: AnalysisContextProps) {
  const { setActiveData, setSelectedState, selectedState } = useMapLayer();

  function handleGoBack() {
    setActiveData(null);
    setSelectedState("br");
    onRequestSectionChange?.("modules");
  }

  const { statusItems, currentState } = useMemo(() => {
    const stateData = droughtData[selectedState as keyof typeof droughtData] || droughtData.br;

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
      )
    );
  };

  const handleSearch = (value: string) => {
  const result = resolveStateKeyFromSearch(value, statesObj);
  setSelectedState(result.key);
  };

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
          <div className="h-6 w-full" />

          {/* Aqui fica o texto de apoio orientando a busca por estado ou cidade. (Pesquise um estado ou cidade para iniciar a análise)*/}
          <div className="h-6 w-full" />
        </header>

        <section className="flex flex-col gap-4">
          <div className="flex gap-4">
            <SearchBarPlatform onSearch={handleSearch} />
          </div>

          <div className="flex flex-col gap-[6px]">
            {/* Aqui fica o rotulo da data da analise. (Data de análise)*/}
            <div className="h-5 w-[120px]" />

            <div className="min-h-10 rounded-md border border-[#DCDBDC] bg-white">
              {/* Aqui fica o select da data da analise. (Selecione a data)*/}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-8">
          <div className="h-6 w-[64px]">
            {/* Aqui fica o identificador da localidade selecionada, por exemplo Brasil. */}
          </div>

          <div className="flex flex-col gap-2">
            <div className="h-6 w-[170px]">
              {/* Aqui fica o titulo da secao de informacoes gerais. */}
            </div>

            <div className="min-h-10 rounded-lg bg-white">
              {/* Aqui fica o card de alerta com icone e resumo da classificacao predominante. (Região majoritariamente sem seca)*/}
            </div>
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
                {statusItems.map((item) => (
                  <div
                    key={item.id}
                    style={{ 
                      width: `${item.value}%`, 
                      backgroundColor: item.color 
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
                      {item.label}: <span className="font-bold">{item.value}%</span>
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
