"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Ref } from "react";
import { jsPDF } from "jspdf";
import { useTranslations } from "next-intl";
import type { CommunicationReportSelection } from "@/components/SidePanelContexts/CommunicationContext";

interface CommunicationReportViewerProps {
  selection: CommunicationReportSelection;
}

const ZOOM_STEP = 10;
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const DEFAULT_ZOOM = 100;
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = Math.floor((A4_HEIGHT_PT * PAGE_WIDTH) / A4_WIDTH_PT);

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

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
        width: PAGE_WIDTH,
        minHeight: PAGE_HEIGHT,
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
  const printableRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [isDownloading, setIsDownloading] = useState(false);
  const [contentHeight, setContentHeight] = useState(PAGE_HEIGHT);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const fileName = t("viewer.fileName", {
    area: selection.area.replace(/\s+/g, "-"),
  });

  const fitScale = availableWidth > 0 ? availableWidth / PAGE_WIDTH : 1;
  const scale = fitScale * (zoom / 100);
  const totalPages = Math.max(1, Math.ceil(contentHeight / PAGE_HEIGHT));

  useEffect(() => {
    const previewElement = previewRef.current;
    if (!previewElement) return;

    const observer = new ResizeObserver(([entry]) => {
      setContentHeight(entry.contentRect.height);
    });
    observer.observe(previewElement);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const observer = new ResizeObserver(([entry]) => {
      setAvailableWidth(entry.contentRect.width);
    });
    observer.observe(scrollElement);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    function handleWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;

      event.preventDefault();
      const direction = event.deltaY > 0 ? -1 : 1;
      setZoom((current) => clampZoom(current + direction * ZOOM_STEP));
    }

    scrollElement.addEventListener("wheel", handleWheel, { passive: false });
    return () => scrollElement.removeEventListener("wheel", handleWheel);
  }, []);

  const syncCurrentPage = useCallback(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const scaledPageHeight = PAGE_HEIGHT * scale;
    const page = Math.floor(scrollElement.scrollTop / scaledPageHeight) + 1;
    setCurrentPage(Math.min(totalPages, Math.max(1, page)));
  }, [scale, totalPages]);

  useEffect(() => {
    syncCurrentPage();
  }, [syncCurrentPage]);

  async function handleDownload() {
    const printableElement = printableRef.current;
    if (!printableElement || isDownloading) return;

    setIsDownloading(true);
    try {
      const pdf = new jsPDF({
        unit: "pt",
        format: "a4",
        orientation: "portrait",
      });

      await pdf.html(printableElement, {
        margin: 0,
        width: A4_WIDTH_PT,
        windowWidth: PAGE_WIDTH,
        html2canvas: {
          useCORS: true,
          backgroundColor: "#FFFFFF",
          logging: false,
        },
      });

      pdf.save(fileName);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <section className="flex h-full flex-col bg-[#A1A89D]">
      <div className="flex h-12 shrink-0 items-center gap-4 border-b border-neutral-300 bg-[#E4E5E2] px-6 font-inter text-sm text-[#292829]">
        <h2 className="min-w-0 flex-1 basis-0 truncate font-medium">
          {fileName}
        </h2>

        <div className="flex shrink-0 items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-white px-3 py-2 text-sm shadow-sm tabular-nums">
              {currentPage}
            </span>
            <span className="tabular-nums">/ {totalPages}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setZoom((current) => clampZoom(current - ZOOM_STEP))
              }
              disabled={zoom <= MIN_ZOOM}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-[#989F43] shadow-sm transition hover:bg-[#F6F7F6] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={t("viewer.zoomOut")}
            >
              -
            </button>
            <span className="rounded-md bg-white px-3 py-2 text-sm shadow-sm tabular-nums">
              {zoom}%
            </span>
            <button
              type="button"
              onClick={() =>
                setZoom((current) => clampZoom(current + ZOOM_STEP))
              }
              disabled={zoom >= MAX_ZOOM}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-[#989F43] shadow-sm transition hover:bg-[#F6F7F6] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={t("viewer.zoomIn")}
            >
              +
            </button>
          </div>
        </div>

        <div className="flex flex-1 basis-0 justify-end">
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex h-9 items-center rounded-md bg-[#989F43] px-4 text-sm font-medium text-white transition hover:bg-[#858c35] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDownloading ? t("viewer.loading") : t("viewer.download")}
          </button>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-[-10000px] top-0 opacity-0"
      >
        <ReportHtmlTemplate htmlRef={printableRef} selection={selection} />
      </div>

      <div
        ref={scrollRef}
        onScroll={syncCurrentPage}
        style={{ scrollbarGutter: "stable" }}
        className="min-h-0 flex-1 overflow-auto p-6"
      >
        <div
          className="mx-auto"
          style={{ width: PAGE_WIDTH * scale, height: contentHeight * scale }}
        >
          <div
            ref={previewRef}
            className="w-fit shadow-xl"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <ReportHtmlTemplate htmlRef={null} selection={selection} />
          </div>
        </div>
      </div>
    </section>
  );
}
