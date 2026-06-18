"use client";

import { useState, useMemo } from "react";

import geodata from "../../data/CDI_Janeiro_2024_Vetores.json";
import droughtData from "../../../public/dados-seca.json";
import SearchBar from "../SearchBar/SearchBar";
import { Link } from "@/translations/routing";
import { useTranslations } from "next-intl";
import MapComponent from "../Map/MapComponent";
import { AlertTiers } from "../AlertTiers/AlertTiers";
import type { SearchSubmissionMetadata } from "@/components/SearchBar/types";
import type { CDIVectorData } from "@/lib/geo";
import { resolveStateKeyFromSearch } from "@/lib/geo";
import { trackUiEvent } from "@/services/telemetry/client";
import { statesObj } from "@/utils/constants";

const HOME_TELEMETRY_CONTEXT = {
  activeLayerId: "CDI",
  activeLayerName: "CDI Janeiro 2024",
  activeDateLabel: "31/01/24",
} as const;

const TIER_CONFIG = {
  "sem-seca": { color: "#E4E5E2" },
  observacao: { color: "#FFCC80" },
  atencao: { color: "#FB8C00" },
  alerta: { color: "#BF360C" },
  "recuperacao-total": { color: "#A3B18A" },
  "recuperacao-parcial": { color: "#588157" },
};

export default function DroughtSection() {
  const [selectedState, setSelectedState] = useState("br");
  const t = useTranslations("MapSection");

  const handleSearch = (value: string, metadata: SearchSubmissionMetadata) => {
    const result = resolveStateKeyFromSearch(value, statesObj);

    if (result.type === "city") {
      trackUiEvent({
        eventName: "search_not_found",
        surface: "home",
        query: value,
        selectionMethod: metadata.selectionMethod,
        visibleOptionCount: metadata.visibleOptionCount,
        resolvedLocationType: result.type,
        resolvedStateKey: result.key,
        resolvedMunicipalityCode: result.city.code,
        ...HOME_TELEMETRY_CONTEXT,
      });
      return;
    }

    setSelectedState(result.key);

    trackUiEvent({
      eventName: "search_found",
      surface: "home",
      query: value,
      selectionMethod: metadata.selectionMethod,
      visibleOptionCount: metadata.visibleOptionCount,
      resolvedLocationType: result.type,
      resolvedStateKey: result.key,
      ...HOME_TELEMETRY_CONTEXT,
    });
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
          value: Number(percentage.toFixed(1)),
          label: t(`tiers.${key}`),
          color: TIER_CONFIG[key as keyof typeof TIER_CONFIG].color,
        };
      });

      const dominantConfig = TIER_CONFIG[maxKey as keyof typeof TIER_CONFIG];

      const stateName = t.has(`states.${selectedState}`)
        ? t(`states.${selectedState}`)
        : stateData.nome;

      const semSecaPercent = (stateData.status["sem-seca"] * 100).toFixed(1);
      const alertaPercent = (stateData.status["alerta"] * 100).toFixed(1);
      const recuperacaoPercent = (
        (stateData.status["recuperacao-total"] +
          stateData.status["recuperacao-parcial"]) *
        100
      ).toFixed(1);

      const acontecendoText = t("droughtData.acontecendo", {
        semSeca: semSecaPercent,
        nome: stateName,
        alerta: alertaPercent,
      });

      const impactoList = [
        t("droughtData.impacto.stable", { semSeca: semSecaPercent }),
        t("droughtData.impacto.alert", { alerta: alertaPercent }),
        t("droughtData.impacto.improvement", { recuperacao: recuperacaoPercent }),
      ];

      return {
        statusItems: items,
        highestStatus: t(`tiers.${maxKey}`),
        highestStatusColor: dominantConfig.color,
        currentState: {
          ...stateData,
          nome: stateName,
          acontecendo: acontecendoText,
          impacto: impactoList,
        },
      };
    }, [selectedState, t]);

  const cdiData = geodata as unknown as CDIVectorData;

  return (
    <section className="w-full bg-white flex flex-col items-center text-[#292829]">
      <div className="w-full max-w-[1440px] mx-auto px-4 py-12 md:px-10 lg:px-[80px]">
        <h2 className="text-2xl font-bold mb-6">
          {t("understandDrought")}
        </h2>

        <div className="mb-6 w-full">
          <SearchBar
            onSearch={handleSearch}
            searchTelemetryContext={HOME_TELEMETRY_CONTEXT}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="flex flex-col gap-4 h-full min-h-[500px]">
            <div className="relative flex w-full h-full min-h-[500px] z-10 rounded-2xl overflow-hidden border border-neutral-200 shadow-sm">
              <MapComponent
                mapMode="demo"
                center={[-15.749997, -47.9499962]}
                zoom={4}
                dadosCDI={cdiData}
                estadoSelecionado={selectedState.toUpperCase()}
                onStateSelect={(uf: string) =>
                  setSelectedState(uf.toLowerCase())
                }
                className="w-full h-full"
              />

              {/* Overlay button: Veja mais -> /platform */}
              <div className="absolute bottom-6 left-6 z-30 w-full sm:w-auto flex justify-start">
                <Link
                  href="/platform"
                  className="w-full sm:w-[582px] bg-[#989F43] text-white rounded-[6px] px-4 py-3 flex items-center justify-center gap-2 hover:opacity-90 transition"
                >
                  <span className="text-[14px] font-medium">{t("seeMore")}</span>

                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    className="h-4 w-4 text-white"
                    aria-hidden="true"
                  >
                    <path
                      d="M6 4L10 8L6 12"
                      stroke="currentColor"
                      strokeWidth="1.33333"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <header className="flex flex-wrap justify-between items-start gap-4">
              <div className="w-full flex flex-col md:flex-row gap-4 justify-between">
                <div className="flex flex-col gap-1">
                  <h1 className="text-4xl font-bold tracking-tight">
                    {currentState.nome}
                  </h1>
                  <div className="text-[10px] text-neutral-500 mt-2 uppercase font-semibold space-y-0.5">
                    <p>{t("analysisDate", { date: "31/01/24" })}</p>
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
                    {t("mostlyIn", { status: highestStatus })}
                  </span>
                </div>
              </div>
            </header>

            <article>
              <h3 className="text-xl font-bold mb-4">{t("generalInfo")}</h3>
              <div className="space-y-5">
                <div>
                  <h4 className="font-bold text-base">
                    {t("whatsHappening")}
                  </h4>
                  <p className="text-neutral-600 text-sm leading-relaxed mt-1">
                    {currentState.acontecendo}
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-base">{t("practicalImpact")}</h4>
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
      </div>
    </section>
  );
}
