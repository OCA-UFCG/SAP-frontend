"use client";

import type {
  AnalysisCoverage,
  AnalyzePayload,
  Cities,
  ExcludedCities,
} from "@/utils/amfeInterfaces";
import {
  buildAnalysisMapPng,
  type AnalysisMapImageOptions,
} from "./exportAnalysisMapImage";
import {
  buildAnalysisReportModel,
  type ReportTranslator,
} from "./analysisReportModel";
import { renderAnalysisReportHtml } from "./analysisReportHtml";

/** O navegador barrou a janela; quem chamou decide como avisar a pessoa. */
export class PopupBlockedError extends Error {
  constructor() {
    super("The browser blocked the report window");
    this.name = "PopupBlockedError";
  }
}

const PRINT_SETTLE_MS = 300;

/**
 * Gera o relatório e manda imprimir.
 *
 * A janela abre antes da captura de propósito: `buildAnalysisMapPng` leva
 * segundos, e uma janela aberta depois do `await` já não conta como resposta ao
 * clique — o bloqueador de pop-up a mata.
 *
 * @example await downloadAnalysisReport(imageOptions, cities, coverage, excluded, payload, criteriaLabels, t, locale)
 */
export const downloadAnalysisReport = async (
  options: AnalysisMapImageOptions,
  cities: Cities,
  coverage: AnalysisCoverage | null,
  excludedCities: ExcludedCities,
  payload: AnalyzePayload,
  criteriaLabels: Record<string, string>,
  t: ReportTranslator,
  locale: string,
): Promise<void> => {
  const printWindow = window.open("", "_blank", "popup,width=980,height=800");
  if (!printWindow) throw new PopupBlockedError();

  printWindow.document.write(
    `<!doctype html><meta charset="utf-8"><title></title><p style="font:14px sans-serif;padding:24px">${t(
      "reportGenerating",
    )}</p>`,
  );

  try {
    const mapPng = await buildAnalysisMapPng(options, t);
    // Quem fechou a janela durante a captura cancelou, não errou.
    if (printWindow.closed) return;

    const model = buildAnalysisReportModel(
      cities,
      coverage,
      excludedCities,
      payload,
      t,
      criteriaLabels,
    );

    printWindow.document.open();
    printWindow.document.write(
      renderAnalysisReportHtml(model, mapPng, t, locale),
    );
    printWindow.document.close();
    printWindow.document.title = t("reportFileName");

    printWindow.addEventListener("afterprint", () => printWindow.close(), {
      once: true,
    });

    // O mapa é um data URL: imprimir antes de ele decodificar sai em branco.
    const finish = () => {
      printWindow.focus();
      printWindow.print();
    };

    if (printWindow.document.readyState === "complete") {
      window.setTimeout(finish, PRINT_SETTLE_MS);
    } else {
      printWindow.addEventListener(
        "load",
        () => window.setTimeout(finish, PRINT_SETTLE_MS),
        { once: true },
      );
    }
  } catch (error) {
    printWindow.close();
    throw error;
  }
};
