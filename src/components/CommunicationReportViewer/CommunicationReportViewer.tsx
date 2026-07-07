"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Ref } from "react";
import { jsPDF } from "jspdf";
import { useTranslations } from "next-intl";
import type { CommunicationReportSelection } from "@/components/SidePanelContexts/CommunicationContext";

interface CommunicationReportViewerProps {
  selection: CommunicationReportSelection;
}

const ZOOM_STEP = 10;
const MIN_ZOOM = 60;
const MAX_ZOOM = 120;

function ReportHtmlTemplate({
  htmlRef,
  selection,
}: {
  htmlRef: Ref<HTMLElement>;
  selection: CommunicationReportSelection;
}) {
  const t = useTranslations("CommunicationContext");
  const generatedAt = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  return (
    <article
      ref={htmlRef}
      style={{
        width: 794,
        minHeight: 1120,
        background: "#FFFFFF",
        color: "#292829",
        fontFamily: "Arial, Helvetica, sans-serif",
        padding: "40px 56px",
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          background: "#155D2D",
          color: "#FFFFFF",
          padding: "20px 32px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            lineHeight: "28px",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          {t("viewer.reportTitle")}
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 11 }}>
          {t("viewer.reportSubtitle")}
        </p>
      </header>

      <table
        style={{
          width: "100%",
          marginTop: 24,
          borderCollapse: "collapse",
          fontSize: 11,
        }}
      >
        <tbody>
          <tr>
            <th style={headerCellStyle}>{t("viewer.analysisArea")}</th>
            <td style={bodyCellStyle}>{selection.area}</td>
            <th style={headerCellStyle}>{t("viewer.scale")}</th>
            <td style={bodyCellStyle}>{t("viewer.selectedArea")}</td>
          </tr>
          <tr>
            <th style={headerCellStyle}>{t("viewer.generatedAt")}</th>
            <td style={bodyCellStyle}>{generatedAt}</td>
            <th style={headerCellStyle}>{t("viewer.reference")}</th>
            <td style={bodyCellStyle}>{t("viewer.currentMonth")}</td>
          </tr>
        </tbody>
      </table>

      <table
        style={{
          width: "100%",
          marginTop: 20,
          borderCollapse: "collapse",
          fontSize: 11,
        }}
      >
        <tbody>
          <tr>
            <th style={{ ...headerCellStyle, width: 180 }}>
              {t("viewer.selectedVariables")}
            </th>
            <td style={bodyCellStyle}>
              {selection.items.length > 0
                ? selection.items.join(" · ")
                : t("viewer.noVariables")}
            </td>
          </tr>
        </tbody>
      </table>

      <section style={{ marginTop: 28 }}>
        <h2
          style={{
            margin: 0,
            background: "#197238",
            color: "#FFFFFF",
            padding: "12px 16px",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          1. {t("modules.drought.title")}
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            marginTop: 18,
            border: "1px solid #D4D4D4",
          }}
        >
          <div style={{ padding: 16, fontSize: 12, lineHeight: "20px" }}>
            <p style={{ margin: 0, fontWeight: 700 }}>
              {t("viewer.currentSituation")}
            </p>
            <p style={{ margin: "10px 0 0" }}>
              {t("viewer.currentSituationBody", { area: selection.area })}
            </p>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "#D86F1B",
              color: "#FFFFFF",
              padding: 16,
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {t("modules.drought.title")}
            </span>
            <strong style={{ marginTop: 8, fontSize: 36 }}>XX%</strong>
            <span style={{ marginTop: 4, fontSize: 11 }}>
              {t("viewer.analysisCoverage")}
            </span>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2
          style={{
            margin: "0 0 12px",
            color: "#60737A",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {t("viewer.droughtClasses")}
        </h2>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 11,
          }}
        >
          <tbody>
            {["S0", "D1", "D2", "D3", "D4"].map((code, index) => (
              <tr
                key={code}
                style={
                  index === 0
                    ? { background: "#197238", color: "#FFFFFF" }
                    : undefined
                }
              >
                <td style={bodyCellStyle}>{code}</td>
                <td style={bodyCellStyle}>
                  {t(`viewer.classDescriptions.${code}`)}
                </td>
                <td style={{ ...bodyCellStyle, textAlign: "center" }}>--</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </article>
  );
}

const headerCellStyle = {
  border: "1px solid #D4D4D4",
  background: "#F2F2F2",
  color: "#60737A",
  padding: "10px 12px",
  textAlign: "left" as const,
  fontWeight: 700,
};

const bodyCellStyle = {
  border: "1px solid #D4D4D4",
  padding: "10px 12px",
  textAlign: "left" as const,
};

export function CommunicationReportViewer({
  selection,
}: CommunicationReportViewerProps) {
  const t = useTranslations("CommunicationContext");
  const reportRef = useRef<HTMLElement>(null);
  const [zoom, setZoom] = useState(75);
  const [pdfUrl, setPdfUrl] = useState("");
  const fileName = t("viewer.fileName", {
    area: selection.area.replace(/\s+/g, "-"),
  });
  const viewerUrl = pdfUrl ? `${pdfUrl}#page=1&zoom=${zoom}` : "";
  const reportSignature = `${selection.area}:${selection.items.join("|")}`;

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;

    async function generatePdfFromHtml() {
      const reportElement = reportRef.current;
      if (!reportElement) return;

      const pdf = new jsPDF({
        unit: "px",
        format: [794, 1120],
        orientation: "portrait",
      });

      await pdf.html(reportElement, {
        margin: 0,
        width: 794,
        windowWidth: 794,
        html2canvas: {
          scale: 1,
          useCORS: true,
          backgroundColor: "#FFFFFF",
        },
      });

      if (cancelled) return;

      objectUrl = URL.createObjectURL(pdf.output("blob"));
      setPdfUrl(objectUrl);
    }

    void generatePdfFromHtml();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [reportSignature]);

  return (
    <section className="flex h-full flex-col bg-[#A1A89D]">
      <div className="flex h-12 shrink-0 items-center gap-4 border-b border-neutral-300 bg-[#E4E5E2] px-6 font-inter text-sm text-[#292829]">
        <h2 className="min-w-0 flex-1 truncate font-medium">{fileName}</h2>

        <div className="flex items-center gap-2">
          <span className="rounded-md bg-white px-3 py-2 text-sm shadow-sm">
            1
          </span>
          <span>/ 1</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP))
            }
            className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-[#989F43] shadow-sm transition hover:bg-[#F6F7F6]"
            aria-label={t("viewer.zoomOut")}
          >
            -
          </button>
          <span className="rounded-md bg-white px-3 py-2 text-sm shadow-sm">
            {zoom}%
          </span>
          <button
            type="button"
            onClick={() =>
              setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP))
            }
            className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-[#989F43] shadow-sm transition hover:bg-[#F6F7F6]"
            aria-label={t("viewer.zoomIn")}
          >
            +
          </button>
        </div>

        <a
          href={pdfUrl || undefined}
          download={fileName}
          aria-disabled={!pdfUrl}
          className="flex h-9 items-center rounded-md bg-[#989F43] px-4 text-sm font-medium text-white transition hover:bg-[#858c35] aria-disabled:pointer-events-none aria-disabled:opacity-60"
        >
          {t("viewer.download")}
        </a>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-[-10000px] top-0 opacity-0"
      >
        <ReportHtmlTemplate htmlRef={reportRef} selection={selection} />
      </div>

      <div className="min-h-0 flex-1 p-6">
        {viewerUrl ? (
          <iframe
            key={viewerUrl}
            src={viewerUrl}
            title={fileName}
            className="h-full w-full border-0 bg-white shadow-xl"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-white font-inter text-sm text-[#292829]">
            {t("viewer.loading")}
          </div>
        )}
      </div>
    </section>
  );
}
