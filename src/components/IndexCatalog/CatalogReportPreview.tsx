"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getMunicipalReportPresentation } from "@/config/municipalReport";
import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";
import type { IndexCatalogReportPreview } from "@/types/indexCatalog";
import { catalogApiRequest } from "@/components/IndexCatalog/catalogApiClient";
import { MunicipalReportNotes } from "@/components/MunicipalReport/MunicipalReportNotes";
import { ReportPreviewVisuals } from "@/components/IndexCatalog/CatalogReportPreviewVisuals";
import { CatalogReportVariablesPanel } from "@/components/IndexCatalog/CatalogReportVariablesPanel";
import { getContrastTextColor } from "@/utils/functions";
import { getVisibleChartColor } from "@/utils/municipalReportChart";
import {
  buildAnalysisNarrativeSections,
  buildSituationNarrative,
  formatReportPeriod,
} from "@/utils/municipalReportNarrative";
import { translateClassLabel } from "@/utils/municipalReportTranslations";
import {
  formatMunicipalReportValue,
  getMunicipalReportValueLabels,
} from "@/utils/municipalReportValue";

/** A prévia é uma tela administrativa em pt-BR; o relatório real é traduzido. */
const PREVIEW_LOCALE = "pt-BR";
/**
 * O texto escrito no catálogo é pt, e as narrativas do relatório só resolvem
 * nesse idioma: pedir outro esvaziaria justamente o que a prévia serve para
 * conferir.
 */
const PREVIEW_NARRATIVE_LOCALE = "pt";

interface CatalogReportPreviewProps {
  entryId: string;
  /**
   * A rota de tiles do rascunho. É ela que desenha a imagem espacial de um
   * índice que ainda não existe em produção — `/api/ee` só conhece camadas
   * publicadas.
   */
  tileApiPath: string;
}

function ReportPreviewFrame({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="overflow-hidden rounded-xl border border-[#D9DAD4] bg-white"
      aria-label="Prévia do Relatório Automático"
    >
      {children}
    </section>
  );
}

function DominantClassCard({
  analysis,
  sectionColor,
  translateLabel,
}: {
  analysis: MunicipalReportAnalysis;
  sectionColor: string;
  translateLabel: (label: string) => string;
}) {
  const dominant = analysis.snapshot?.dominantClass;
  if (!dominant) return null;
  const background = dominant.color || sectionColor;
  const labels = getMunicipalReportValueLabels(analysis);

  return (
    <div
      className="flex min-h-40 flex-col items-center justify-center px-5 py-7 text-center"
      style={{
        backgroundColor: background,
        color: getContrastTextColor(background),
      }}
    >
      <strong className="text-lg">{translateLabel(dominant.label)}</strong>
      <span className="mt-1 text-3xl font-bold">
        {formatMunicipalReportValue(
          dominant.percentage,
          analysis,
          PREVIEW_LOCALE,
        )}
      </span>
      <span className="mt-2 text-xs">{labels.cardContext}</span>
    </div>
  );
}

function DistributionTable({
  analysis,
  translateLabel,
}: {
  analysis: MunicipalReportAnalysis;
  translateLabel: (label: string) => string;
}) {
  const labels = getMunicipalReportValueLabels(analysis);

  return (
    <table className="w-full border-collapse text-sm">
      <thead className="bg-[#176b39] text-white">
        <tr>
          <th className="border-r border-white/40 px-4 py-2 text-left">
            Classe
          </th>
          <th className="w-40 px-4 py-2 text-right">{labels.tableValue}</th>
        </tr>
      </thead>
      <tbody>
        {analysis.snapshot?.distribution.map((item) => {
          const visibleColor = getVisibleChartColor(item.color);
          return (
            <tr key={item.id} className="border-t border-[#c8ced1]">
              <td
                className="border-r border-[#c8ced1] px-4 py-2 font-medium"
                style={{ backgroundColor: `${visibleColor}33` }}
              >
                <span
                  className="mr-2 inline-block h-2.5 w-2.5 rounded-full border border-black/10"
                  style={{ backgroundColor: visibleColor }}
                />
                {translateLabel(item.label)}
              </td>
              <td
                className="px-4 py-2 text-right font-semibold"
                style={{ backgroundColor: `${visibleColor}33` }}
              >
                {formatMunicipalReportValue(
                  item.percentage,
                  analysis,
                  PREVIEW_LOCALE,
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * O texto e os valores deste índice como apareceriam no Relatório Automático de
 * Campina Grande - PB.
 *
 * Reusa as mesmas funções de narrativa do relatório de produção — inclusive a
 * frase automática de "Situação atual" quando o catálogo não escreve uma — para
 * que a prévia mostre o texto real, e não uma aproximação.
 */
function ReportPreviewBody({
  preview,
  tileApiPath,
}: {
  preview: IndexCatalogReportPreview;
  tileApiPath: string;
}) {
  const t = useTranslations("MunicipalReport");
  const tCaption = useTranslations("PlatformMapCaption");
  // A resposta da rota é entrada externa como qualquer fetch: sem análise não
  // há prévia a desenhar, e a tela do catálogo não pode cair por causa disso.
  const analysis = preview.report?.analyses?.[0];
  if (!analysis) {
    return (
      <p className="p-5 text-sm text-stone-500">
        A prévia do relatório não veio com nenhuma análise para este índice.
      </p>
    );
  }

  const translateLabel = (label: string) =>
    translateClassLabel(
      label,
      t,
      (key) => t.has(key),
      tCaption,
      (key) => tCaption.has(key),
    );
  const presentation = getMunicipalReportPresentation(analysis.id);
  const sectionColor =
    analysis.presentation?.sectionColor ?? presentation.sectionColor;
  const situation = buildSituationNarrative(
    analysis,
    preview.docsContent,
    preview.report,
    presentation,
    PREVIEW_NARRATIVE_LOCALE,
  );
  const narrativeSections = buildAnalysisNarrativeSections(
    analysis,
    preview.docsContent,
    PREVIEW_NARRATIVE_LOCALE,
  );
  const referencePeriod =
    analysis.effectivePeriod ?? analysis.snapshot?.period ?? preview.period;
  const periodLabel = formatReportPeriod(referencePeriod, PREVIEW_LOCALE);

  return (
    <>
      <h2
        className="px-5 py-2.5 text-xl font-bold"
        style={{
          backgroundColor: sectionColor,
          color: getContrastTextColor(sectionColor),
        }}
      >
        1. {analysis.title}
      </h2>

      {analysis.status !== "available" || !analysis.snapshot ? (
        <p className="m-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          O Earth Engine não devolveu valores para {preview.municipality.name} —{" "}
          {preview.municipality.uf} em {periodLabel}. No relatório real esta
          seção apareceria como indisponível.
        </p>
      ) : (
        <>
          <div className="m-5 grid border border-[#d9e0e3] md:grid-cols-[1fr_226px]">
            <div className="p-5 text-[15px] leading-6 text-neutral-800">
              <p className="font-bold">
                Situação atual{" "}
                <span className="font-normal text-[#536e7b]">
                  {preview.municipality.name} — {preview.municipality.uf}
                </span>
              </p>
              {situation && (
                <p className="mt-2 whitespace-pre-line text-justify">
                  {situation}
                </p>
              )}
              <p className="mt-4 border-t border-[#d9e0e3] pt-3 text-sm">
                <span className="font-bold text-[#536e7b]">
                  Período analisado:{" "}
                </span>
                {periodLabel}
              </p>
            </div>
            <DominantClassCard
              analysis={analysis}
              sectionColor={sectionColor}
              translateLabel={translateLabel}
            />
          </div>

          <div className="mx-5 overflow-hidden border border-[#c8ced1]">
            <DistributionTable
              analysis={analysis}
              translateLabel={translateLabel}
            />
          </div>

          <ReportPreviewVisuals
            analysis={analysis}
            municipality={preview.municipality}
            referencePeriod={referencePeriod}
            tileApiPath={tileApiPath}
            translateLabel={translateLabel}
          />

          {narrativeSections.length > 0 && (
            <div className="m-5 border border-[#d9e0e3] p-5 text-[15px] leading-6">
              <h3 className="font-bold text-[#536e7b]">Análise</h3>
              {narrativeSections.map((section) => (
                <p
                  key={section.title}
                  className="mt-3 whitespace-pre-line text-justify text-neutral-800"
                >
                  <strong>{section.title}:</strong> {section.text}
                </p>
              ))}
            </div>
          )}

          <div className="mx-5 mb-5">
            <MunicipalReportNotes
              analyses={[analysis]}
              docsContent={preview.docsContent}
              locale={PREVIEW_NARRATIVE_LOCALE}
            />
          </div>
        </>
      )}
    </>
  );
}

interface ReportPreviewState {
  entryId: string;
  preview: IndexCatalogReportPreview | null;
  error: string;
}

export function CatalogReportPreview({
  entryId,
  tileApiPath,
}: CatalogReportPreviewProps) {
  const [state, setState] = useState<ReportPreviewState | null>(null);

  useEffect(() => {
    let active = true;
    catalogApiRequest<IndexCatalogReportPreview>(
      `/api/index-catalog/drafts/${encodeURIComponent(entryId)}/report-preview`,
    )
      .then((preview) => {
        if (active) setState({ entryId, preview, error: "" });
      })
      .catch((reason) => {
        if (!active) return;
        setState({
          entryId,
          preview: null,
          error:
            reason instanceof Error
              ? reason.message
              : "Falha ao montar a prévia do relatório.",
        });
      });
    return () => {
      active = false;
    };
  }, [entryId]);

  // Comparar o `entryId` guardado com o atual é o que evita mostrar a prévia de
  // um índice enquanto a de outro carrega, sem limpar o estado dentro do efeito.
  const current = state?.entryId === entryId ? state : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold">Prévia do Relatório Automático</h3>
        <p className="text-xs text-stone-500">
          Campina Grande - PB, no período mais recente do índice
        </p>
      </div>
      <ReportPreviewFrame>
        {current?.error ? (
          <p className="p-5 text-sm text-red-700">{current.error}</p>
        ) : current?.preview ? (
          <ReportPreviewBody
            preview={current.preview}
            tileApiPath={tileApiPath}
          />
        ) : (
          <p className="p-5 text-sm text-stone-500">
            Lendo os valores de Campina Grande no Earth Engine…
          </p>
        )}
      </ReportPreviewFrame>
      {current?.preview && (
        // A resposta da rota é um `cast`, não um payload validado: uma versão
        // publicada antes deste campo existir chegaria aqui sem ele.
        <CatalogReportVariablesPanel
          variables={current.preview.variables ?? []}
        />
      )}
    </div>
  );
}
