"use client";

import { useLocale, useTranslations } from "next-intl";
import { useAmfeAnalysis } from "./AmfeAnalysisContext";

/** Erro da análise e a linha de cobertura, logo acima da moldura do mapa. */
export function AmfeAnalysisStatusLines() {
  const t = useTranslations("Analyze");
  const locale = useLocale();
  const { coverage, error, loading } = useAmfeAnalysis();

  return (
    <>
      {error && !loading && (
        <div className="flex h-64 items-center justify-center">
          <p className="text-center font-medium text-red-600">
            {t("error", { error })}
          </p>
        </div>
      )}

      {!loading && coverage && (
        <p className="mb-2 text-sm text-gray-600">
          <span>{t("coverageLabel")} </span>
          <span className="text-[#989F43]">
            {t("coverageMunicipalities", {
              count: coverage.count.toLocaleString(locale),
              totalCount: coverage.totalCount.toLocaleString(locale),
            })}
          </span>
          {coverage.excludedCount > 0 && (
            <span className="text-red-600">
              {t("omitted", {
                excludedCount: coverage.excludedCount.toLocaleString(locale),
              })}
            </span>
          )}
        </p>
      )}
    </>
  );
}
