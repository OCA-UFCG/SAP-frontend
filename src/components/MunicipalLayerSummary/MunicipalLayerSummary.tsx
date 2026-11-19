"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  buildEmbeddedTerritorialAnalysisViewModel,
  getAnalysisYearOptions,
  getEffectiveAnalysisYear,
} from "@/components/analysis/analysis.mappers";
import { isGeeStatisticsLayerId } from "@/config/geeStatisticsLayers";
import municipalAvailabilityIndex from "@/data/municipalAvailabilityIndex.json";
import { htmlLang } from "@/translations/htmlLang";
import type { AnalysisDistributionItem } from "@/utils/analysis";
import { formatDekadPeriod } from "@/utils/dekadPeriod";
import {
  formatAbsoluteNumber,
  formatPercentageNumber,
} from "@/utils/formatTerritorialNumber";
import type { PanelLayerI } from "@/utils/interfaces";
import {
  hasMunicipalLayerPeriod,
  isMunicipalLayerIndexed,
  type MunicipalAvailabilityIndex,
} from "@/utils/municipalAvailability";
import { mergePartialMunicipalImageData } from "@/utils/municipalAnalysisMerge";

type ImageData = PanelLayerI["imageData"];

// Uma resposta por produto, período e município, guardada enquanto a página
// estiver aberta: abrir e fechar a categoria, ou ir ao Detalhamento e voltar,
// não pede de novo.
const responses = new Map<string, Promise<ImageData | null>>();

function fetchMunicipalImageData(
  layer: PanelLayerI,
  yearKey: string,
  municipalityCode: string,
): Promise<ImageData | null> {
  const apiPath =
    layer.municipalAnalysisApiPath ??
    `/api/municipal-analysis/${encodeURIComponent(layer.id)}`;
  const key = `${apiPath}::${yearKey}::${municipalityCode}`;
  const cached = responses.get(key);
  if (cached) return cached;

  const url = new URL(apiPath, window.location.origin);
  url.searchParams.set("year", yearKey);
  url.searchParams.set("locationKey", municipalityCode);
  const request = fetch(url, { credentials: "same-origin" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`status ${response.status}`);
      const body = (await response.json()) as { imageData?: ImageData | null };
      return body.imageData ?? null;
    })
    .catch((error: unknown) => {
      // Uma falha passageira não fica guardada: a próxima vez tenta de novo.
      responses.delete(key);
      throw error;
    });
  responses.set(key, request);
  return request;
}

/** Para testes: esquece as respostas guardadas. */
export function clearMunicipalLayerSummaryCache() {
  responses.clear();
}

/** O período em palavras, como no Detalhamento: "21 a 30 de setembro de 2026". */
function formatPeriod(label: string, locale: string) {
  const dekad = formatDekadPeriod(label, locale);
  if (dekad) return dekad;
  const month = label.match(/^(\d{4})-(\d{2})$/u);
  if (!month) return label;
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(month[1]), Number(month[2]) - 1, 1)));
}

type SummaryState =
  | { status: "loading" }
  | { status: "unavailable" }
  | {
      status: "ready";
      distribution: AnalysisDistributionItem[];
      valueType: "percentage" | "absolute";
      valueUnit?: string;
    };

function useMunicipalLayerSummary(
  layer: PanelLayerI,
  municipalityCode: string,
  activeYear: string,
  enabled: boolean,
) {
  const tCaption = useTranslations("PlatformMapCaption");
  const numberLocale = htmlLang(useLocale());
  const yearKey = getEffectiveAnalysisYear(layer, activeYear);
  const usesGeeStatistics = Boolean(
    layer.statisticsSource || isGeeStatisticsLayerId(layer.id),
  );
  const availabilityIndex =
    municipalAvailabilityIndex as MunicipalAvailabilityIndex;
  // O índice de disponibilidade já diz quando um produto não tem o município
  // naquele período; nesse caso nem se pergunta ao servidor.
  const knownUnavailable =
    !yearKey ||
    (!usesGeeStatistics &&
      isMunicipalLayerIndexed(availabilityIndex, layer.id) &&
      !hasMunicipalLayerPeriod(
        availabilityIndex,
        municipalityCode,
        layer.id,
        yearKey,
      ));

  const requestKey = `${layer.id}::${yearKey}::${municipalityCode}`;
  const [result, setResult] = useState<{
    key: string;
    imageData: ImageData | null;
  } | null>(null);

  useEffect(() => {
    if (!enabled || knownUnavailable || !yearKey) return;
    let cancelled = false;
    fetchMunicipalImageData(layer, yearKey, municipalityCode)
      .then((imageData) => {
        if (!cancelled) setResult({ key: requestKey, imageData });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: requestKey, imageData: null });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, knownUnavailable, layer, municipalityCode, requestKey, yearKey]);

  const periodLabel = useMemo(() => {
    if (!yearKey) return null;
    const label =
      getAnalysisYearOptions(layer, numberLocale).find(
        (option) => option.value === yearKey,
      )?.label ?? yearKey;
    return yearKey === "general" ? null : formatPeriod(label, numberLocale);
  }, [layer, numberLocale, yearKey]);

  const state = useMemo<SummaryState>(() => {
    if (knownUnavailable) return { status: "unavailable" };
    if (result?.key !== requestKey) return { status: "loading" };
    if (!result.imageData) return { status: "unavailable" };
    // O mesmo caminho do "Panorama geral" do Detalhamento: rótulos traduzidos
    // e números arredondados do mesmo jeito.
    const model = buildEmbeddedTerritorialAnalysisViewModel(
      {
        ...layer,
        imageData: mergePartialMunicipalImageData(
          layer.imageData,
          result.imageData,
        ),
      },
      yearKey,
      municipalityCode,
      tCaption,
      undefined,
      numberLocale,
    );
    if (!model || model.distribution.length === 0) {
      return { status: "unavailable" };
    }
    return {
      status: "ready",
      distribution: model.distribution,
      valueType: model.valueType ?? "percentage",
      valueUnit: model.valueUnit,
    };
  }, [
    knownUnavailable,
    layer,
    municipalityCode,
    numberLocale,
    requestKey,
    result,
    tCaption,
    yearKey,
  ]);

  return { state, periodLabel, numberLocale };
}

function ClassSwatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/10"
      style={{ backgroundColor: color }}
    />
  );
}

/**
 * A situação de um produto no município escolhido, presa embaixo do cartão
 * do produto no Monitoramento. Aberta (produto ligado no mapa), mostra também
 * a divisão por classe e o atalho para o Detalhamento.
 */
export function MunicipalLayerSummary({
  layer,
  municipalityCode,
  activeYear,
  expanded,
  enabled,
  onOpenDetails,
}: {
  layer: PanelLayerI;
  municipalityCode: string;
  /** O período escolhido no mapa; vale só para o produto ligado. */
  activeYear: string;
  expanded: boolean;
  /** Fechada a categoria, o cartão não pede nada ao servidor. */
  enabled: boolean;
  onOpenDetails: () => void;
}) {
  const t = useTranslations("ModulesContext");
  const { state, periodLabel, numberLocale } = useMunicipalLayerSummary(
    layer,
    municipalityCode,
    activeYear,
    enabled,
  );

  const formatValue = (value: number) =>
    state.status === "ready" && state.valueType === "absolute"
      ? `${formatAbsoluteNumber(value, numberLocale)} ${state.valueUnit ?? ""}`.trim()
      : `${formatPercentageNumber(value, numberLocale)}%`;

  const dominant =
    state.status === "ready"
      ? state.distribution.reduce((max, item) =>
          item.value > max.value ? item : max,
        )
      : null;
  const hasClasses = state.status === "ready" && state.distribution.length > 1;
  const showBar =
    expanded && hasClasses && state.status === "ready" && state.valueType === "percentage";

  return (
    <div
      className={`-mt-2 flex flex-col gap-2 rounded-b-lg border border-t-0 px-3 pt-4 pb-2.5 text-[0.75rem] leading-[18px] text-[#292829] ${
        expanded ? "border-[#646B2D] bg-[#F5F6EE]" : "border-[#EFEFEF] bg-[#FAFAF8]"
      }`}
      title={periodLabel ?? undefined}
      aria-live="polite"
    >
      {state.status === "loading" ? (
        <span className="flex items-center gap-2 text-[#6F6F6F]">
          <span
            aria-hidden="true"
            className="h-3 w-24 rounded bg-[#E4E5E2] motion-safe:animate-pulse"
          />
          <span className="sr-only">{t("municipalSummary.loading")}</span>
        </span>
      ) : state.status === "unavailable" ? (
        <span className="text-[#6F6F6F]">{t("municipalSummary.unavailable")}</span>
      ) : dominant && hasClasses ? (
        <span className="flex items-center gap-1.5">
          <ClassSwatch color={dominant.color} />
          <span>
            {t.rich("municipalSummary.predominant", {
              label: dominant.label,
              value: formatValue(dominant.value),
              b: (chunks) => <b className="font-semibold">{chunks}</b>,
            })}
          </span>
        </span>
      ) : dominant ? (
        <span>
          {t.rich("municipalSummary.single", {
            value: formatValue(dominant.value),
            b: (chunks) => <b className="font-semibold">{chunks}</b>,
          })}
        </span>
      ) : null}

      {expanded && state.status === "ready" ? (
        <>
          {periodLabel ? (
            <span className="text-[#6F6F6F]">{periodLabel}</span>
          ) : null}
          {showBar ? (
            <div className="flex h-5 w-full overflow-hidden rounded">
              {state.distribution
                .filter((item) => item.value > 0)
                .map((item) => (
                  <div
                    key={item.id}
                    style={{ width: `${item.value}%`, backgroundColor: item.color }}
                    title={`${item.label}: ${formatValue(item.value)}`}
                  />
                ))}
            </div>
          ) : null}
          {hasClasses ? (
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
              {state.distribution
                .filter((item) => item.value > 0)
                .map((item) => (
                  <li key={item.id} className="flex min-w-0 items-start gap-1.5">
                    <span className="mt-[3px]">
                      <ClassSwatch color={item.color} />
                    </span>
                    <span className="min-w-0 break-words">
                      {item.label}: <b className="font-semibold">{formatValue(item.value)}</b>
                    </span>
                  </li>
                ))}
            </ul>
          ) : null}
          <button
            type="button"
            onClick={onOpenDetails}
            className="self-start rounded font-semibold text-[#4F5424] underline underline-offset-2 hover:text-[#292829] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F5424]"
          >
            {t("municipalSummary.openDetails")}
          </button>
        </>
      ) : null}
    </div>
  );
}
