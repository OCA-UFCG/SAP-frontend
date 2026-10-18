"use client";

import { useEffect, useMemo, useState } from "react";
import type { EeMapUrlFailure } from "@/contracts/eeMapUrls";
import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";
import {
  fetchMunicipalValues,
  toClassByCode,
} from "@/components/PlatformMap/useIndexChoroplethValues";
import type { ReportMapChoropleth } from "./ReportMapPreview";

/** Um mapa do relatório que é coropleta: chave da fila, camada e faixas. */
export interface ReportMapChoroplethRequest {
  key: string;
  analysis: Pick<MunicipalReportAnalysis, "id" | "mapChoropleth">;
  period: string;
}

export interface ReportMapChoropleths {
  /** Verdadeiro quando toda coropleta já tem valores ou um motivo para não ter. */
  resolved: boolean;
  choroplethFor: (key: string) => ReportMapChoropleth | undefined;
  failureFor: (key: string) => EeMapUrlFailure | undefined;
}

interface LoadedChoropleths {
  signature: string;
  choropleths: ReadonlyMap<string, ReportMapChoropleth>;
  failures: ReadonlyMap<string, EeMapUrlFailure>;
}

const EMPTY: LoadedChoropleths = {
  signature: "",
  choropleths: new Map(),
  failures: new Map(),
};

/**
 * Os valores por município dos índices de planilha do relatório, já
 * convertidos na faixa de cor de cada município.
 *
 * Esses índices não têm imagem no Earth Engine, então não passam por
 * `/api/ee/map-urls`: o mapa deles é pintado no navegador, como no
 * Monitoramento, a partir da mesma rota de valores municipais.
 *
 * @example
 * const { resolved, choroplethFor } = useReportMapChoropleths(requests);
 */
export function useReportMapChoropleths(
  requests: readonly ReportMapChoroplethRequest[],
): ReportMapChoropleths {
  const signature = requests.map(({ key }) => key).join(",");
  const [state, setState] = useState<LoadedChoropleths>(EMPTY);
  // A assinatura muda junto com as chaves; o resto do pedido é derivado delas.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableRequests = useMemo(() => requests, [signature]);

  useEffect(() => {
    if (!signature) return;
    const controller = new AbortController();

    void Promise.all(
      stableRequests.map(async ({ key, analysis, period }) => {
        try {
          const values = await fetchMunicipalValues(
            `/api/municipal-analysis/${encodeURIComponent(analysis.id)}/choropleth`,
            period,
            controller.signal,
          );
          const { palette = [], thresholds = [] } =
            analysis.mapChoropleth ?? {};
          const choropleth: ReportMapChoropleth = {
            palette,
            classByCode: toClassByCode(values, thresholds),
          };
          return [key, choropleth] as const;
        } catch (reason) {
          if (!controller.signal.aborted) {
            console.error(
              `[municipalReport] falha ao ler os valores municipais de ${key}:`,
              reason,
            );
          }
          return [key, null] as const;
        }
      }),
    ).then((entries) => {
      if (controller.signal.aborted) return;
      const choropleths = new Map<string, ReportMapChoropleth>();
      const failures = new Map<string, EeMapUrlFailure>();
      for (const [key, choropleth] of entries) {
        if (choropleth) choropleths.set(key, choropleth);
        else failures.set(key, "error");
      }
      setState({ signature, choropleths, failures });
    });

    return () => controller.abort();
  }, [signature, stableRequests]);

  const current = state.signature === signature ? state : EMPTY;

  return useMemo(
    () => ({
      resolved: !signature || current.signature === signature,
      choroplethFor: (key: string) => current.choropleths.get(key),
      failureFor: (key: string) => current.failures.get(key),
    }),
    [current, signature],
  );
}
