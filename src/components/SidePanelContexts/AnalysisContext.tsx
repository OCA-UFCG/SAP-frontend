"use client";

import { useMapLayer } from "@/components/MapLayerContext/MapLayerContext";
import { Chevron } from "@/components/Chevron/Chevron";
import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";
import type { PanelLayerI } from "@/utils/interfaces";
import { statesObj } from "@/utils/constants";
import SearchBarPlatform from "./SearchBarPlatform";
import { resolveStateKeyFromSearch } from "@/utils/functions";
import { classificationMeta } from "@/utils/constants";
import type { ClassificationKey } from "@/utils/constants";
import { useState } from "react";
import locationDataJson from "../../../public/dados-seca.json"

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

function getPredominantClassification(
  status: Record<ClassificationKey, number>
): ClassificationKey {
  return (Object.entries(status) as [ClassificationKey, number][]).reduce(
    (max, cur) => (cur[1] > max[1] ? cur : max)
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
}: AnalysisContextProps) {
  const { setActiveData, setSelectedState } = useMapLayer();

  const [locationData, setLocationData] = useState<LocationData>(
    locationDataJson["br"]
  );

  function handleGoBack() {
    setActiveData(null);
    setSelectedState("br");
    setLocationData(locationDataJson["br"]);
    onRequestSectionChange?.("modules");
  }

  const handleSearch = (value: string) => {
    const result = resolveStateKeyFromSearch(value, statesObj);
    setSelectedState(result.key);
    const data = locationDataJson[result.key as keyof typeof locationDataJson];
    if (data) setLocationData(data);
  };

  const predominantInfo = locationData
    ? getPredominantInfo(locationData.status)
    : null;

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

          <div className="w-[392px] flex flex-col gap-2">            
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
            <div className="h-6 w-[220px]">
              {/* Aqui fica o titulo da secao "O que esta acontecendo?". */}
            </div>

            <div className="min-h-[54px] rounded-lg">
              {/* Aqui fica o texto explicativo resumindo o cenario atual. */}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="h-6 w-[260px]">
              {/* Aqui fica o titulo da porcentagem de area por classificacao. */}
            </div>

            <div className="rounded-lg border border-[#EFEFEF] bg-white p-2">
              <div className="min-h-10 rounded-md bg-[#F6F7F6]">
                {/* Aqui ficam as barras empilhadas por categoria. */}
              </div>

              <div className="mt-4 min-h-10 rounded-md bg-[#F6F7F6]">
                {/* Aqui fica a legenda com as classificacoes e suas respectivas cores. */}
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
