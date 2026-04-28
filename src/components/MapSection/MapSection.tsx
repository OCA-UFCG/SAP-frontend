"use client";

import { useState, useMemo } from "react";

import geodata from "../../data/CDI_Janeiro_2024_Vetores.json";
import droughtData from "../../../public/dados-seca.json";
import SearchBar from "../SearchBar/SearchBar";
import MapComponent from "../Map/MapComponent";
import { AlertTiers } from "../AlertTiers/AlertTiers";
import type { CDIVectorData } from "@/lib/geo";
import { resolveStateKeyFromSearch } from "@/lib/geo";
import { statesObj } from "@/utils/constants";

const TIER_CONFIG = {
  "sem-seca": { label: "Sem seca", color: "#E4E5E2" },
  observacao: { label: "Observação", color: "#FFCC80" },
  atencao: { label: "Atenção", color: "#FB8C00" },
  alerta: { label: "Seca severa", color: "#BF360C" },
  "recuperacao-total": { label: "Recuperação Total", color: "#A3B18A" },
  "recuperacao-parcial": { label: "Recuperação Parcial", color: "#588157" },
};

export default function DroughtSection() {
  const [selectedState, setSelectedState] = useState("br");

  const handleSearch = (value: string) => {
    const result = resolveStateKeyFromSearch(value, statesObj);
    setSelectedState(result.key);
  };

  /**
   * 1 & 2. Data Transformation & Dynamic Badge Logic
   * Calculates percentages to 1 decimal place and finds the dominant status.
   */
  const { statusItems, highestStatus, highestStatusColor, currentState } =
    useMemo(() => {
      const stateData =
        droughtData[selectedState as keyof typeof droughtData] ||
        droughtData.br;

      let maxVal = -1;
      let maxKey = "sem-seca";

      const items = Object.entries(stateData.status).map(([key, value]) => {
        const percentage = (value as number) * 100;

        if (percentage > maxVal) {
          maxVal = percentage;
          maxKey = key;
        }

        return {
          id: key,
          // 1. One decimal place formatting
          value: Number(percentage.toFixed(1)),
          label: TIER_CONFIG[key as keyof typeof TIER_CONFIG].label,
          color: TIER_CONFIG[key as keyof typeof TIER_CONFIG].color,
        };
      });

      const dominantConfig = TIER_CONFIG[maxKey as keyof typeof TIER_CONFIG];

      return {
        statusItems: items,
        highestStatus: dominantConfig.label,
        highestStatusColor: dominantConfig.color,
        currentState: stateData,
      };
    }, [selectedState]);

  const cdiData = geodata as unknown as CDIVectorData;

  // Helper to determine text color for the checkmark icon based on background brightness
  const isLightColor = ["#E4E5E2", "#FFCC80"].includes(highestStatusColor);

  return (
    <section className="max-w-7xl py-8 mx-auto text-[#292829] px-4 md:px-8">
      <h2 className="text-2xl font-bold mb-6">Entenda a seca na sua região</h2>

      <div className="mb-8 w-full">
        <SearchBar onSearch={handleSearch} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <div className="flex flex-col gap-4 h-full min-h-[500px]">
          <div className="relative flex w-full h-full min-h-[500px] z-10 rounded-2xl overflow-hidden border border-neutral-200 shadow-sm">
            <MapComponent
              center={[-15.749997, -47.9499962]}
              zoom={4}
              dadosCDI={cdiData}
              estadoSelecionado={selectedState.toUpperCase()}
              className="w-full h-full"
            />
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <header className="flex flex-wrap justify-between items-start gap-4">
            <div className="w-full flex flex-col md:flex-row gap-4 justify-between">
              <div className="flex flex-col gap-1">
                <h1 className="text-4xl font-bold tracking-tight">
                  {currentState.nome}
                </h1>
                <div className="text-[10px] text-neutral-500 mt-2 uppercase font-semibold space-y-0.5">
                  <p>Data da análise: 31/01/24</p>
                </div>
              </div>
              <div
                className="flex items-center gap-3 px-4 py-2 rounded-xl border transition-all duration-500 h-fit"
                style={{
                  backgroundColor: `${highestStatusColor}15`,
                  borderColor: `${highestStatusColor}30`,
                }}
              >
                <span className="text-sm font-bold">
                  Majoritariamente em: {highestStatus}
                </span>
              </div>
            </div>

            {/* Dynamic Status Badge */}
          </header>

          <article>
            <h3 className="text-xl font-bold mb-4">Informações gerais</h3>
            <div className="space-y-5">
              <div>
                <h4 className="font-bold text-base">O que está acontecendo?</h4>
                <p className="text-neutral-600 text-sm leading-relaxed mt-1">
                  {currentState.acontecendo}
                </p>
              </div>
              <div>
                <h4 className="font-bold text-base">Impacto na prática</h4>
                <ul className="list-disc ml-5 space-y-2 text-sm text-neutral-600 mt-2">
                  {currentState.impacto.map((item, i) => (
                    <li key={i} className="pl-1">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>

          {/* Pie Chart Component */}
          <AlertTiers items={statusItems} />
        </div>
      </div>
    </section>
  );
}
